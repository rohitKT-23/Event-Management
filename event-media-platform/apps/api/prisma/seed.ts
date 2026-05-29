/**
 * Seed script. Creates an admin user, a sample club, a public event,
 * and one album. Idempotent on email/username collisions.
 *
 *   $ npm run prisma:seed
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient, UserRole, EventCategory, ClubRole } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
dotenv.config({ path: rootEnv });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const password = await bcrypt.hash('Admin@1234', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@emp.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@emp.local',
      passwordHash: password,
      role: UserRole.ADMIN,
      isVerified: true,
      bio: 'Platform administrator',
    },
  });

  const photographer = await prisma.user.upsert({
    where: { email: 'photographer@emp.local' },
    update: {},
    create: {
      username: 'lens.master',
      email: 'photographer@emp.local',
      passwordHash: password,
      role: UserRole.PHOTOGRAPHER,
      isVerified: true,
      bio: 'Capturing moments since 2018.',
    },
  });

  const club = await prisma.club.upsert({
    where: { slug: 'photography-club' },
    update: {},
    create: {
      name: 'Photography Club',
      slug: 'photography-club',
      description: 'A community for shutterbugs and storytellers.',
      createdById: admin.id,
      memberships: {
        create: [
          { userId: admin.id, role: ClubRole.ADMIN },
          { userId: photographer.id, role: ClubRole.MEMBER },
        ],
      },
    },
  });

  const event = await prisma.event.upsert({
    where: { slug: 'spring-photowalk-2026' },
    update: {},
    create: {
      clubId: club.id,
      name: 'Spring Photowalk 2026',
      slug: 'spring-photowalk-2026',
      description: 'Capture the bloom across downtown.',
      category: EventCategory.PHOTOSHOOT,
      date: new Date(),
      location: 'Downtown Park',
      isPublic: true,
      createdById: admin.id,
    },
  });

  await prisma.album.create({
    data: {
      eventId: event.id,
      name: 'Highlights',
      description: 'Best of the day',
      isPublic: true,
      createdById: photographer.id,
    },
  });

  console.log('✓ Seeded admin@emp.local / Admin@1234');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
