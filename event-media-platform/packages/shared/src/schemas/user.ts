import { z } from 'zod';
import { usernameSchema } from './auth.js';
import { UserRole } from '../enums.js';

export const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  bio: z.string().max(500).nullish(),
  avatarUrl: z.string().url().nullish(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.PHOTOGRAPHER, UserRole.CLUB_MEMBER, UserRole.VIEWER]),
});

export type PublicUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  createdAt: string;
};
