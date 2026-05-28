import { z } from 'zod';

export const cuidSchema = z.string().min(20).max(40);
export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid slug');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({ id: cuidSchema });

export type ApiError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};
