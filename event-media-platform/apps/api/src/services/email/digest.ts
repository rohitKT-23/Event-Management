import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { buildIdempotencyKey } from '../email/index.js';
import { enqueueEmail } from '../queue.js';

export async function enqueueWeeklyDigestForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });
  if (!user) return;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [uploadCount, likeCount] = await Promise.all([
    prisma.media.count({ where: { uploaderId: userId, createdAt: { gte: weekAgo } } }),
    prisma.like.count({ where: { media: { uploaderId: userId }, createdAt: { gte: weekAgo } } }),
  ]);

  const highlights =
    uploadCount || likeCount
      ? `This week: ${uploadCount} new upload${uploadCount === 1 ? '' : 's'} and ${likeCount} new like${likeCount === 1 ? '' : 's'} on your media.`
      : 'Catch up on new events and photos from your clubs.';

  const weekKey = weekAgo.toISOString().slice(0, 10);

  await enqueueEmail(
    {
      to: user.email,
      templateId: 'weekly-digest',
      vars: {
        username: user.username,
        digestUrl: `${env.WEB_BASE_URL}/dashboard`,
        highlights,
      },
      idempotencyKey: buildIdempotencyKey('weekly-digest', user.id, weekKey),
    },
    { jobId: `weekly-digest:${user.id}:${weekKey}` },
  );
}
