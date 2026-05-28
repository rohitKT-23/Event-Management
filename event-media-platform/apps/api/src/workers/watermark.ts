/**
 * Pipeline 2 — Watermark on download.
 *
 *  download original → sharp composite (club, event, role badge,
 *  diagonal logo at 15% opacity) → upload watermarked variant →
 *  persist watermarkUrl + emit socket event.
 */
import { Worker, type Job } from 'bullmq';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { redisQueue } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { QUEUE_NAMES, type WatermarkJob } from '../services/queue.js';
import { BUCKETS, presignedGetUrl, s3 } from '../services/s3.js';
import { emitToUser } from '../services/socket.js';

async function fetchBuffer(bucket: string, key: string): Promise<Buffer> {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  const stream = r.Body as NodeJS.ReadableStream;
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

function svgWatermark(width: number, height: number, lines: { tl?: string; bl?: string; br?: string }) {
  const fontSize = Math.max(16, Math.floor(width / 50));
  const padding = Math.floor(fontSize * 1.2);
  const txt = (x: number, y: number, anchor: string, text?: string) =>
    text
      ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" fill="white" stroke="rgba(0,0,0,0.6)" stroke-width="1">${text}</text>`
      : '';
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${txt(padding, padding + fontSize, 'start', lines.tl)}
      ${txt(padding, height - padding, 'start', lines.bl)}
      ${txt(width - padding, height - padding, 'end', lines.br)}
      <text x="${width / 2}" y="${height / 2}"
            text-anchor="middle" transform="rotate(-30 ${width / 2} ${height / 2})"
            font-family="Inter, Arial, sans-serif" font-size="${fontSize * 4}"
            fill="white" fill-opacity="0.15">EMP</text>
    </svg>`,
  );
}

async function processJob(job: Job<WatermarkJob>) {
  const { mediaId, userId } = job.data;
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      event: { include: { club: true } },
      uploader: { select: { role: true, username: true } },
    },
  });
  if (!media) throw new Error('Media not found');

  const original = await fetchBuffer(BUCKETS.ORIGINAL, media.s3Key);
  const img = sharp(original).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;

  const overlay = svgWatermark(w, h, {
    tl: media.event?.club?.name,
    bl: media.event?.name,
    br: `${media.uploader.username} • ${media.uploader.role}`,
  });

  const out = await img
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  const wmKey = `watermarked/${media.s3Key}.jpg`;
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKETS.WATERMARKED, Key: wmKey, Body: out, ContentType: 'image/jpeg' }),
  );

  await prisma.media.update({ where: { id: mediaId }, data: { watermarkUrl: wmKey } });
  const signed = await presignedGetUrl(BUCKETS.WATERMARKED, wmKey, 300);
  await prisma.download.create({
    data: { userId, mediaId, watermarkedUrl: signed, bytesServed: BigInt(out.length) },
  });

  emitToUser(userId, 'download:ready', { mediaId, url: signed });
  logger.info({ mediaId, userId }, 'watermark complete');
}

export function startWatermarkWorker() {
  const worker = new Worker<WatermarkJob>(QUEUE_NAMES.WATERMARK, processJob, {
    connection: redisQueue,
    concurrency: 2,
  });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'watermark failed'));
  return worker;
}
