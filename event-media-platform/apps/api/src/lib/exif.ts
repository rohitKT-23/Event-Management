/**
 * EXIF extraction from a Sharp metadata() EXIF buffer.
 *
 * `exif-reader` is loaded lazily so the dependency is optional. Returns a
 * trimmed, JSON-serialisable subset plus decimal GPS coordinates when present.
 */
import { logger } from './logger.js';

export type ExtractedExif = {
  exif: Record<string, unknown> | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
};

const EMPTY: ExtractedExif = { exif: null, gpsLatitude: null, gpsLongitude: null };

function toDecimal(
  coord: number[] | undefined,
  ref: string | undefined,
): number | null {
  if (!coord || coord.length < 3) return null;
  const [deg, min, sec] = coord;
  let dec = (deg ?? 0) + (min ?? 0) / 60 + (sec ?? 0) / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return Number.isFinite(dec) ? Number(dec.toFixed(6)) : null;
}

export async function extractExif(exifBuffer: Buffer | undefined): Promise<ExtractedExif> {
  if (!exifBuffer || exifBuffer.length === 0) return EMPTY;
  try {
    const { default: exifReader } = await import('exif-reader');
    const parsed: any = exifReader(exifBuffer);
    if (!parsed) return EMPTY;

    const image = parsed.Image ?? {};
    const photo = parsed.Photo ?? {};
    const gps = parsed.GPSInfo ?? {};

    const exif: Record<string, unknown> = {
      make: image.Make ?? null,
      model: image.Model ?? null,
      lensModel: photo.LensModel ?? null,
      focalLength: photo.FocalLength ?? null,
      fNumber: photo.FNumber ?? null,
      iso: photo.ISOSpeedRatings ?? photo.PhotographicSensitivity ?? null,
      exposureTime: photo.ExposureTime ?? null,
      dateTaken: photo.DateTimeOriginal ?? image.DateTime ?? null,
      orientation: image.Orientation ?? null,
    };

    // Drop null-only keys to keep the JSON compact.
    const cleaned = Object.fromEntries(
      Object.entries(exif).filter(([, v]) => v !== null && v !== undefined),
    );

    const gpsLatitude = toDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
    const gpsLongitude = toDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);

    return {
      exif: Object.keys(cleaned).length ? cleaned : null,
      gpsLatitude,
      gpsLongitude,
    };
  } catch (err) {
    logger.debug({ err }, 'exif parse failed (continuing)');
    return EMPTY;
  }
}
