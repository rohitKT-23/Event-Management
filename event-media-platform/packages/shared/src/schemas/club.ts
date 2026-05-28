import { z } from 'zod';
import { ClubRole } from '../enums.js';

export const createClubSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().nullish(),
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

export const updateClubSchema = createClubSchema.partial();
export type UpdateClubInput = z.infer<typeof updateClubSchema>;

export const addMemberSchema = z.object({
  userId: z.string().min(20),
  role: z.enum([ClubRole.ADMIN, ClubRole.MEMBER]).default(ClubRole.MEMBER),
});
