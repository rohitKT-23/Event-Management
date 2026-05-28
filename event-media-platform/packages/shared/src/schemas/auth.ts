import { z } from 'zod';
import { UserRole } from '../enums.js';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, dot, underscore, hyphen');

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  role: z
    .enum([UserRole.VIEWER, UserRole.CLUB_MEMBER, UserRole.PHOTOGRAPHER])
    .default(UserRole.VIEWER),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
};
