import { z } from 'zod';

export const createAlbumSchema = z.object({
  eventId: z.string().min(20),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().default(true),
});
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;

export const updateAlbumSchema = createAlbumSchema.partial().omit({ eventId: true });

export const addCollaboratorSchema = z.object({
  userId: z.string().min(20),
});
