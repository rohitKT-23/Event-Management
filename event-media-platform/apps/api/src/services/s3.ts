/**
 * Thin wrapper around the AWS S3 SDK with helpers for:
 *  - presigned PUT (direct browser → S3 upload)
 *  - presigned GET (signed download URL)
 *  - presigned POST (form-style upload)
 *  - object key conventions per BRD
 *
 * Works against real AWS or MinIO (set AWS_* env vars + custom endpoint
 * in dev). All buckets are private; processed media is served via
 * CloudFront when configured.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { env } from '../config/env.js';

export const s3 = new S3Client({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
  // For local MinIO: set AWS_ENDPOINT in env and forcePathStyle.
  // (Picked up by SDK v3 from process.env.AWS_ENDPOINT_URL_S3 too.)
});

export const BUCKETS = {
  ORIGINAL: env.S3_BUCKET_ORIGINAL,
  PROCESSED: env.S3_BUCKET_PROCESSED,
  WATERMARKED: env.S3_BUCKET_WATERMARKED,
  AVATARS: env.S3_BUCKET_AVATARS,
  SELFIES: env.S3_BUCKET_SELFIES,
} as const;

/** Build a deterministic, namespaced key for uploads. */
export function buildMediaKey(uploaderId: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(0, 8);
  const id = nanoid(16);
  const date = new Date().toISOString().slice(0, 10);
  return `media/${date}/${uploaderId}/${id}${ext}`;
}

export function buildSelfieKey(userId: string): string {
  return `selfies/${userId}/${nanoid(12)}.jpg`;
}

export function buildAvatarKey(userId: string, ext = '.jpg'): string {
  return `avatars/${userId}/${nanoid(8)}${ext}`;
}

export async function presignedPutUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

/** Download an object's bytes into memory. */
export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body as unknown as { transformToByteArray: () => Promise<Uint8Array> };
  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function presignedGetUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

/**
 * Build a public CDN URL for a processed media object.
 * Falls back to a direct (presigned) URL when CloudFront isn't configured.
 */
export function cdnUrlFor(key: string): string | null {
  if (!env.CLOUDFRONT_DOMAIN) return null;
  return `https://${env.CLOUDFRONT_DOMAIN}/${key}`;
}

type MediaWithUrls = {
  s3Key?: string;
  uploadStatus?: string;
  thumbnailUrl?: string | null;
  cdnUrl?: string | null;
  watermarkUrl?: string | null;
};

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function bucketForObjectKey(key: string): string {
  if (key.startsWith('watermarked/')) return BUCKETS.WATERMARKED;
  if (key.startsWith('processed/') || key.startsWith('thumbnails/')) return BUCKETS.PROCESSED;
  if (key.startsWith('media/')) return BUCKETS.ORIGINAL;
  return BUCKETS.PROCESSED;
}

function derivedThumbKey(s3Key: string): string {
  return `thumbnails/${s3Key.replace(/^media\//, '')}.jpg`;
}

/** Turn stored S3 keys into browser-loadable URLs (presigned when CloudFront is off). */
export async function resolveMediaUrls<T extends MediaWithUrls>(media: T): Promise<T> {
  const out = { ...media };

  if (out.thumbnailUrl && !isHttpUrl(out.thumbnailUrl)) {
    out.thumbnailUrl = await presignedGetUrl(BUCKETS.PROCESSED, out.thumbnailUrl);
  } else if (!out.thumbnailUrl && out.s3Key && out.uploadStatus === 'DONE') {
    try {
      out.thumbnailUrl = await presignedGetUrl(BUCKETS.PROCESSED, derivedThumbKey(out.s3Key));
    } catch {
      // thumbnail object missing — leave null
    }
  }

  if (out.cdnUrl && !isHttpUrl(out.cdnUrl)) {
    out.cdnUrl = await presignedGetUrl(bucketForObjectKey(out.cdnUrl), out.cdnUrl);
  }

  if (out.watermarkUrl && !isHttpUrl(out.watermarkUrl)) {
    out.watermarkUrl = await presignedGetUrl(BUCKETS.WATERMARKED, out.watermarkUrl);
  }

  return out;
}

export async function resolveManyMediaUrls<T extends MediaWithUrls>(items: T[]): Promise<T[]> {
  return Promise.all(items.map((item) => resolveMediaUrls(item)));
}
