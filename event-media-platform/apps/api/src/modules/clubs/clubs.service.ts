import { ClubRole, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateClubInput, UpdateClubInput } from '@emp/shared';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function listClubs(page: number, limit: number, q?: string) {
  const where = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }] }
    : {};
  const [data, total] = await Promise.all([
    prisma.club.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { memberships: true, events: true } } },
    }),
    prisma.club.count({ where }),
  ]);
  return { data, total };
}

export async function getClub(id: string) {
  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true, avatarUrl: true } },
      _count: { select: { memberships: true, events: true } },
    },
  });
  if (!club) throw new NotFoundError('Club');
  return club;
}

export async function createClub(input: CreateClubInput, creatorId: string, creatorRole: UserRole) {
  if (creatorRole !== UserRole.ADMIN && creatorRole !== UserRole.PHOTOGRAPHER) {
    throw new ForbiddenError('Only admins or photographers can create clubs');
  }
  const slug = slugify(input.name);
  return prisma.club.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      logoUrl: input.logoUrl ?? null,
      createdById: creatorId,
      memberships: {
        create: { userId: creatorId, role: ClubRole.ADMIN },
      },
    },
  });
}

async function assertClubAdmin(clubId: string, userId: string, userRole: UserRole) {
  if (userRole === UserRole.ADMIN) return;
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  if (!m || m.role !== ClubRole.ADMIN) throw new ForbiddenError('Club admin only');
}

export async function updateClub(id: string, input: UpdateClubInput, userId: string, userRole: UserRole) {
  await assertClubAdmin(id, userId, userRole);
  return prisma.club.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name, slug: slugify(input.name) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    },
  });
}

export async function deleteClub(id: string, userId: string, userRole: UserRole) {
  await assertClubAdmin(id, userId, userRole);
  await prisma.club.delete({ where: { id } });
}

export async function listClubMembers(clubId: string) {
  return prisma.clubMembership.findMany({
    where: { clubId },
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: { id: true, username: true, avatarUrl: true, role: true } } },
  });
}

export async function addClubMember(
  clubId: string,
  targetUserId: string,
  role: ClubRole,
  actorId: string,
  actorRole: UserRole,
) {
  await assertClubAdmin(clubId, actorId, actorRole);
  return prisma.clubMembership.upsert({
    where: { clubId_userId: { clubId, userId: targetUserId } },
    create: { clubId, userId: targetUserId, role },
    update: { role },
  });
}

export async function removeClubMember(
  clubId: string,
  targetUserId: string,
  actorId: string,
  actorRole: UserRole,
) {
  await assertClubAdmin(clubId, actorId, actorRole);
  await prisma.clubMembership.delete({
    where: { clubId_userId: { clubId, userId: targetUserId } },
  });
}
