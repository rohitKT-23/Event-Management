/**
 * Pluggable virus-scanning hook.
 *
 * In production, point this at a ClamAV daemon (set VIRUS_SCAN_ENABLED=true
 * plus CLAMAV_HOST/CLAMAV_PORT). Without configuration it is a no-op that
 * reports every file as clean, so local dev keeps working.
 *
 * The ClamAV client is loaded lazily so the dependency is only required
 * when scanning is actually enabled.
 */
import net from 'node:net';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export type ScanResult = {
  scanned: boolean;
  clean: boolean;
  signature?: string;
};

function isConfigured(): boolean {
  return env.VIRUS_SCAN_ENABLED && Boolean(env.CLAMAV_HOST && env.CLAMAV_PORT);
}

/**
 * Stream a buffer to ClamAV using the INSTREAM protocol.
 * Returns clean=true when ClamAV replies "OK".
 */
function clamavInstream(buffer: Buffer): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: env.CLAMAV_HOST!, port: env.CLAMAV_PORT! });
    let response = '';

    socket.on('error', (err) => {
      logger.warn({ err }, 'clamav connection failed — treating as unscanned');
      socket.destroy();
      resolve({ scanned: false, clean: true });
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const size = Buffer.alloc(4);
      size.writeUInt32BE(buffer.length, 0);
      socket.write(size);
      socket.write(buffer);
      const end = Buffer.alloc(4);
      end.writeUInt32BE(0, 0);
      socket.write(end);
    });

    socket.on('data', (chunk) => {
      response += chunk.toString();
    });

    socket.on('end', () => {
      const clean = response.includes('OK') && !response.includes('FOUND');
      const signature = response.includes('FOUND')
        ? response.replace(/.*stream:\s*/, '').replace(/\s*FOUND.*/, '').trim()
        : undefined;
      resolve({ scanned: true, clean, signature });
    });
  });
}

export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  if (!isConfigured()) {
    return { scanned: false, clean: true };
  }
  try {
    return await clamavInstream(buffer);
  } catch (err) {
    logger.warn({ err }, 'virus scan errored — treating as unscanned');
    return { scanned: false, clean: true };
  }
}
