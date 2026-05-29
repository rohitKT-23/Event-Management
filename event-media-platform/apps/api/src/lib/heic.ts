/**
 * HEIC/HEIF → JPEG conversion.
 *
 * iPhones upload HEIC by default and Sharp's stock libvips often lacks HEIF
 * support, so we convert with `heic-convert` (pure JS) before the rest of the
 * image pipeline runs. Loaded lazily and fully optional.
 */
import { logger } from './logger.js';

const HEIC_MIMES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

export function isHeic(mimeType: string, filename?: string): boolean {
  if (HEIC_MIMES.includes(mimeType.toLowerCase())) return true;
  if (filename && /\.(heic|heif)$/i.test(filename)) return true;
  return false;
}

export async function convertHeicToJpeg(input: Buffer): Promise<Buffer | null> {
  try {
    const mod = await import('heic-convert');
    const convert = (mod as any).default ?? mod;
    const output: ArrayBuffer = await convert({
      buffer: input,
      format: 'JPEG',
      quality: 0.92,
    });
    return Buffer.from(output);
  } catch (err) {
    logger.warn({ err }, 'HEIC conversion failed (continuing with original)');
    return null;
  }
}
