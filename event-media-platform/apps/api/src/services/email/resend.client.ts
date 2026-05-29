import { Resend } from 'resend';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

let client: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  tags?: { name: string; value: string }[];
};

export async function sendViaResend(params: SendEmailParams): Promise<{ id: string } | null> {
  const resend = getResendClient();
  if (!resend) {
    logger.debug({ to: params.to, subject: params.subject }, 'Resend not configured — skipping email');
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    tags: params.tags,
    idempotencyKey: params.idempotencyKey,
  });

  if (error) {
    logger.error({ err: error, to: params.to, subject: params.subject }, 'Resend send failed');
    throw new Error(error.message);
  }

  if (!data?.id) return null;
  logger.info({ id: data.id, to: params.to, subject: params.subject }, 'email sent via Resend');
  return { id: data.id };
}
