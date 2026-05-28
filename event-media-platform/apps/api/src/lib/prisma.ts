import { PrismaClient } from '@prisma/client';
import { env, isProd } from '../config/env.js';

// Single, reused PrismaClient. In dev we attach to globalThis so the
// hot-reload from tsx doesn't open a new pool on every restart.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProd) globalForPrisma.prisma = prisma;
