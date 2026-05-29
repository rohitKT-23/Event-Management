/**
 * Video processing hook.
 *
 * Generates a poster thumbnail (and, when possible, an H.264 MP4) using
 * ffmpeg. ffmpeg is resolved at runtime: if `ffmpeg-static` / `fluent-ffmpeg`
 * aren't installed (or no system ffmpeg exists), this degrades gracefully and
 * the upload still completes — just without a generated poster.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { logger } from '../../lib/logger.js';

export type VideoProcessingResult = {
  posterBuffer: Buffer | null;
  durationSeconds: number | null;
};

async function loadFfmpeg(): Promise<any | null> {
  try {
    const mod = await import('fluent-ffmpeg');
    const ffmpeg = (mod as any).default ?? mod;
    try {
      const staticMod = await import('ffmpeg-static');
      const ffmpegPath = (staticMod as any).default ?? staticMod;
      if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as string);
    } catch {
      // fall back to system ffmpeg on PATH
    }
    return ffmpeg;
  } catch {
    return null;
  }
}

/**
 * Transcode an arbitrary input video to a web-friendly H.264/AAC MP4
 * (`-vcodec libx264 -acodec aac -crf 23`). Returns null (graceful) when
 * ffmpeg is unavailable or the transcode fails, so uploads never break.
 */
export async function transcodeToH264(input: Buffer): Promise<Buffer | null> {
  const ffmpeg = await loadFfmpeg();
  if (!ffmpeg) {
    logger.debug('ffmpeg not available — skipping video transcode');
    return null;
  }

  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `emp-${randomUUID()}.video`);
  const outPath = path.join(tmpDir, `emp-${randomUUID()}.mp4`);

  try {
    await fs.writeFile(inPath, input);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-crf 23', '-preset veryfast', '-movflags +faststart'])
        .on('end', () => resolve())
        .on('error', (err: unknown) => reject(err))
        .save(outPath);
    });
    return await fs.readFile(outPath).catch(() => null);
  } catch (err) {
    logger.warn({ err }, 'video transcode failed (continuing)');
    return null;
  } finally {
    await fs.unlink(inPath).catch(() => undefined);
    await fs.unlink(outPath).catch(() => undefined);
  }
}

export async function generateVideoPoster(input: Buffer): Promise<VideoProcessingResult> {
  const ffmpeg = await loadFfmpeg();
  if (!ffmpeg) {
    logger.debug('ffmpeg not available — skipping video poster generation');
    return { posterBuffer: null, durationSeconds: null };
  }

  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `emp-${randomUUID()}.video`);
  const posterPath = path.join(tmpDir, `emp-${randomUUID()}.jpg`);

  try {
    await fs.writeFile(inPath, input);

    const durationSeconds = await new Promise<number | null>((resolve) => {
      ffmpeg.ffprobe(inPath, (err: unknown, data: any) => {
        if (err) return resolve(null);
        resolve(data?.format?.duration ? Number(data.format.duration) : null);
      });
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .on('end', () => resolve())
        .on('error', (err: unknown) => reject(err))
        .screenshots({
          count: 1,
          timemarks: ['1'],
          filename: path.basename(posterPath),
          folder: path.dirname(posterPath),
          size: '800x?',
        });
    });

    const posterBuffer = await fs.readFile(posterPath).catch(() => null);
    return { posterBuffer, durationSeconds };
  } catch (err) {
    logger.warn({ err }, 'video poster generation failed (continuing)');
    return { posterBuffer: null, durationSeconds: null };
  } finally {
    await fs.unlink(inPath).catch(() => undefined);
    await fs.unlink(posterPath).catch(() => undefined);
  }
}
