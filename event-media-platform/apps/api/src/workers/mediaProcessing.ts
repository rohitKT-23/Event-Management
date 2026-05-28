/**
 * Pipeline 1 — Post-upload processing.
 *
 *   download → compress → thumbnail → pHash (dedup) →
 *   AI labels → moderation → caption → face index → done
 *
 * Each step is best-effort: if an AI provider isn't configured the
 * step is skipped and we log it instead of failing the whole job.
 */
import { Worker, type Job } from 'bullmq';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { redisQueue } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { QUEUE_NAMES, type MediaProcessingJob } from '../services/queue.js';
import { BUCKETS, cdnUrlFor, s3 } from '../services/s3.js';
import { emitToUser } from '../services/socket.js';
import { env } from '../config/env.js';

async function downloadFromS3(bucket: string, key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  const stream = res.Body as NodeJS.ReadableStream;
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

async function uploadToS3(bucket: string, key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

// pHash via sharp: down-sample to 8x8 grayscale and threshold against mean.
async function computePerceptualHash(buffer: Buffer): Promise<string> {
  const small = await sharp(buffer).grayscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
  const mean = small.reduce((sum, byte) => sum + byte, 0) / small.length;
  let hash = '';
  for (let i = 0; i < small.length; i += 1) hash += small[i]! > mean ? '1' : '0';
  return BigInt('0b' + hash).toString(16).padStart(16, '0');
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  const x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let bits = 0;
  let n = x;
  while (n > 0n) { bits += Number(n & 1n); n >>= 1n; }
  return bits;
}

async function findDuplicates(mediaId: string, phash: string) {
  // Coarse pre-filter on prefix to avoid scanning all rows.
  const prefix = phash.slice(0, 4);
  const candidates = await prisma.media.findMany({
    where: { id: { not: mediaId }, phash: { startsWith: prefix } },
    select: { id: true, phash: true },
    take: 500,
  });
  return candidates
    .filter((c) => c.phash && hammingDistance(c.phash, phash) < 10)
    .map((c) => c.id);
}

async function processJob(job: Job<MediaProcessingJob>) {
  const { mediaId, bucket, key, uploaderId } = job.data;
  logger.info({ mediaId, key }, 'media-processing: start');
  try {
    await prisma.media.update({ where: { id: mediaId }, data: { uploadStatus: 'PROCESSING' } });

    const original = await downloadFromS3(bucket, key);
    const meta = await sharp(original).metadata();

    // Step 2/3: compression + thumbnail (photos only)
    let processedBuf: Buffer | null = null;
    let thumbBuf: Buffer | null = null;
    if (meta.format && meta.format !== 'svg') {
      processedBuf = await sharp(original)
        .rotate()
        .resize({ width: 2048, withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      thumbBuf = await sharp(original)
        .rotate()
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    const processedKey = `processed/${key.replace(/^media\//, '')}.jpg`;
    const thumbKey = `thumbnails/${key.replace(/^media\//, '')}.jpg`;

    if (processedBuf) await uploadToS3(BUCKETS.PROCESSED, processedKey, processedBuf, 'image/jpeg');
    if (thumbBuf) await uploadToS3(BUCKETS.PROCESSED, thumbKey, thumbBuf, 'image/jpeg');

    // Step 4: pHash dedup
    const phash = processedBuf ? await computePerceptualHash(processedBuf) : null;
    const duplicates = phash ? await findDuplicates(mediaId, phash) : [];

    // Step 5/6/7/8/9: AI tagging, moderation, caption, faces — stubbed unless creds.
    const aiTags: string[] = [];
    let aiCaption: string | null = null;
    let moderationStatus: 'APPROVED' | 'PENDING' | 'REJECTED' = 'APPROVED';
    let moderationReason: string | null = null;

    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      try {
        const { RekognitionClient, DetectLabelsCommand, DetectModerationLabelsCommand, IndexFacesCommand } =
          await import('@aws-sdk/client-rekognition');
        const rek = new RekognitionClient({ region: env.AWS_REGION });
        const labels = await rek.send(new DetectLabelsCommand({
          Image: { Bytes: original },
          MaxLabels: 10,
          MinConfidence: 70,
        }));
        labels.Labels?.forEach((l) => l.Name && aiTags.push(l.Name));

        const mod = await rek.send(new DetectModerationLabelsCommand({
          Image: { Bytes: original },
          MinConfidence: 70,
        }));
        if (mod.ModerationLabels && mod.ModerationLabels.length > 0) {
          moderationStatus = 'PENDING';
          moderationReason = mod.ModerationLabels.map((m) => m.Name).join(', ');
        }

        const faces = await rek.send(new IndexFacesCommand({
          CollectionId: env.REKOGNITION_COLLECTION_ID,
          Image: { Bytes: original },
          DetectionAttributes: ['DEFAULT'],
          ExternalImageId: mediaId,
        }));
        if (faces.FaceRecords?.length) {
          await prisma.faceIndex.createMany({
            data: faces.FaceRecords.map((f) => ({
              mediaId,
              rekognitionFaceId: f.Face?.FaceId ?? 'unknown',
              boundingBox: f.Face?.BoundingBox as any,
              confidence: f.Face?.Confidence ?? 0,
            })),
            skipDuplicates: true,
          });
        }
      } catch (err) {
        logger.warn({ err, mediaId }, 'rekognition step failed (continuing)');
      }
    } else {
      logger.debug('AWS creds missing — skipping Rekognition');
    }

    if (env.OPENAI_API_KEY && processedBuf) {
      try {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
        const b64 = processedBuf.toString('base64');
        const completion = await client.chat.completions.create({
          model: env.OPENAI_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Write a single concise sentence describing this photo.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
              ],
            },
          ],
          max_tokens: 80,
        });
        aiCaption = completion.choices[0]?.message?.content?.trim() ?? null;
      } catch (err) {
        logger.warn({ err, mediaId }, 'openai caption failed (continuing)');
      }
    }

    const updated = await prisma.media.update({
      where: { id: mediaId },
      data: {
        cdnUrl: processedBuf ? cdnUrlFor(processedKey) : cdnUrlFor(key),
        thumbnailUrl: thumbBuf ? cdnUrlFor(thumbKey) : null,
        width: meta.width ?? null,
        height: meta.height ?? null,
        phash,
        aiTags: { set: aiTags },
        aiCaption,
        moderationStatus,
        moderationReason,
        uploadStatus: 'DONE',
      },
    });

    emitToUser(uploaderId, 'upload:complete', {
      mediaId,
      thumbnailUrl: updated.thumbnailUrl,
      cdnUrl: updated.cdnUrl,
      moderationStatus,
      duplicates,
    });

    logger.info({ mediaId, duplicates: duplicates.length }, 'media-processing: done');
  } catch (err) {
    logger.error({ err, mediaId }, 'media-processing: failed');
    await prisma.media.update({ where: { id: mediaId }, data: { uploadStatus: 'FAILED' } });
    throw err;
  }
}

export function startMediaProcessingWorker() {
  const worker = new Worker<MediaProcessingJob>(QUEUE_NAMES.MEDIA, processJob, {
    connection: redisQueue,
    concurrency: 4,
  });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'media-processing failed'));
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'media-processing complete'));
  return worker;
}
