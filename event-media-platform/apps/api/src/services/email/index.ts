import type { EmailJob, EmailTemplateId } from '../queue.js';
import { sendViaResend } from './resend.client.js';
import { renderEmailTemplate } from './templates.js';

export { isEmailConfigured, sendViaResend } from './resend.client.js';
export { renderEmailTemplate } from './templates.js';
export { enqueueWeeklyDigestForUser } from './digest.js';

export async function deliverEmailJob(job: EmailJob): Promise<{ id: string } | null> {
  const rendered = renderEmailTemplate(job.templateId, job.vars);
  return sendViaResend({
    to: job.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: job.idempotencyKey,
    tags: [{ name: 'template', value: job.templateId }],
  });
}

export function buildIdempotencyKey(templateId: EmailTemplateId, entityId: string, suffix?: string): string {
  const key = `${templateId}/${entityId}${suffix ? `/${suffix}` : ''}`;
  return key.slice(0, 256);
}
