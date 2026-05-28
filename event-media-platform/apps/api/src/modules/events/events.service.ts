import { ClubRole, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateEventInput } from '@emp/shared';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function listEvents(filters: {
  clubId?: string;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  q?: string;
  isPublicOnly: boolean;
  page: number;
  limit: number;
}) {
  const where: any = {};
  if (filters.clubId) where.clubId = filters.clubId;
  if (filters.category) where.category = filters.category;
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = filters.dateFrom;
    if (filters.dateTo) where.date.lte = filters.dateTo;
  }
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
    ];
  }
  if (filters.isPublicOnly) where.isPublic = true;

  const [data, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        club: { select: { id: true, name: true, slug: true, logoUrl: true } },
        _count: { select: { media: true, albums: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);
  return { data, total };
}

export async function getEvent(id: string, viewerId?: string, viewerRole?: UserRole) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      club: { select: { id: true, name: true, slug: true, logoUrl: true } },
      createdBy: { select: { id: true, username: true, avatarUrl: true } },
      _count: { select: { media: true, albums: true } },
    },
  });
  if (!event) throw new NotFoundError('Event');
  if (!event.isPublic) {
    if (!viewerId) throw new ForbiddenError('Event is private');
    if (viewerRole !== UserRole.ADMIN) {
      const member = await prisma.clubMembership.findUnique({
        where: { clubId_userId: { clubId: event.clubId, userId: viewerId } },
      });
      if (!member) throw new ForbiddenError('Event is private to club members');
    }
  }
  return event;
}

async function assertClubMember(clubId: string, userId: string, userRole: UserRole) {
  if (userRole === UserRole.ADMIN) return;
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  if (!m) throw new ForbiddenError('You are not a member of this club');
}

async function assertEventManager(eventId: string, userId: string, userRole: UserRole) {
  if (userRole === UserRole.ADMIN) return;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError('Event');
  if (event.createdById === userId) return;
  const m = await prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId: event.clubId, userId } },
  });
  if (m?.role === ClubRole.ADMIN) return;
  throw new ForbiddenError('You cannot manage this event');
}

export async function createEvent(input: CreateEventInput, userId: string, userRole: UserRole) {
  await assertClubMember(input.clubId, userId, userRole);
  const slugBase = slugify(input.name);
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  return prisma.event.create({
    data: {
      clubId: input.clubId,
      name: input.name,
      slug,
      description: input.description,
      category: input.category,
      coverImageUrl: input.coverImageUrl ?? null,
      date: input.date,
      location: input.location,
      isPublic: input.isPublic,
      createdById: userId,
    },
  });
}

export async function updateEvent(id: string, input: any, userId: string, userRole: UserRole) {
  await assertEventManager(id, userId, userRole);
  return prisma.event.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name, slug: `${slugify(input.name)}-${Date.now().toString(36)}` } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl } : {}),
      ...(input.date ? { date: input.date } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    },
  });
}

export async function deleteEvent(id: string, userId: string, userRole: UserRole) {
  await assertEventManager(id, userId, userRole);
  await prisma.event.delete({ where: { id } });
}

export async function getEventAlbums(eventId: string) {
  return prisma.album.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { media: true, collaborators: true } } },
  });
}

export async function getEventMedia(
  eventId: string,
  page: number,
  limit: number,
  viewerId?: string,
) {
  const where: any = { eventId, moderationStatus: 'APPROVED' };
  if (!viewerId) where.isPublic = true;
  const [data, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { uploader: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.media.count({ where }),
  ]);
  return { data, total };
}
