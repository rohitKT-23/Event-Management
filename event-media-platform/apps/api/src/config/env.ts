/**
 * Centralised, validated configuration.
 *
 * Every env var the app uses must be declared here. We parse with
 * Zod so a missing/invalid var fails fast at startup rather than
 * leaking `undefined` deeper into the request path.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('emp'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_ORIGINAL: z.string().default('emp-media-original'),
  S3_BUCKET_PROCESSED: z.string().default('emp-media-processed'),
  S3_BUCKET_WATERMARKED: z.string().default('emp-watermarked'),
  S3_BUCKET_AVATARS: z.string().default('emp-avatars'),
  S3_BUCKET_SELFIES: z.string().default('emp-selfies'),
  CLOUDFRONT_DOMAIN: z.string().optional(),
  CLOUDFRONT_KEY_PAIR_ID: z.string().optional(),
  CLOUDFRONT_PRIVATE_KEY_PATH: z.string().optional(),

  REKOGNITION_COLLECTION_ID: z.string().default('emp-faces'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@emp.local'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  UPLOAD_DAILY_LIMIT_MB: z.coerce.number().int().default(500),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. Check the errors above.');
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDev = env.NODE_ENV === 'development';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
