import { env } from '../../config/env.js';
import type { EmailTemplateId } from '../queue.js';

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <div style="margin-bottom:24px">
    <strong style="font-size:18px">${env.APP_NAME.toUpperCase()}</strong>
  </div>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px" />
  <p style="font-size:12px;color:#666">You received this email from ${env.APP_NAME}. If you did not request it, you can ignore this message.</p>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a></p>`;
}

export function renderEmailTemplate(
  templateId: EmailTemplateId,
  vars: Record<string, string>,
): RenderedEmail {
  switch (templateId) {
    case 'password-reset': {
      const username = vars.username ?? 'there';
      const resetUrl = vars.resetUrl ?? `${env.WEB_BASE_URL}/reset-password`;
      const subject = 'Reset your password';
      const text = `Hi ${username},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.`;
      const html = layout(
        subject,
        `<p>Hi ${username},</p>
<p>We received a request to reset your password. Click the button below to choose a new one.</p>
${button(resetUrl, 'Reset password')}
<p style="font-size:13px;color:#666">Or copy this link: ${resetUrl}</p>
<p style="font-size:13px;color:#666">This link expires in 1 hour.</p>`,
      );
      return { subject, html, text };
    }

    case 'verify-email': {
      const username = vars.username ?? 'there';
      const verifyUrl = vars.verifyUrl ?? `${env.WEB_BASE_URL}/login`;
      const subject = 'Verify your email address';
      const text = `Hi ${username},\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`;
      const html = layout(
        subject,
        `<p>Hi ${username},</p>
<p>Thanks for signing up. Please verify your email address to unlock the full experience.</p>
${button(verifyUrl, 'Verify email')}
<p style="font-size:13px;color:#666">Or copy this link: ${verifyUrl}</p>
<p style="font-size:13px;color:#666">This link expires in 24 hours.</p>`,
      );
      return { subject, html, text };
    }

    case 'weekly-digest': {
      const username = vars.username ?? 'there';
      const digestUrl = vars.digestUrl ?? env.WEB_BASE_URL;
      const highlights = vars.highlights ?? 'Check out what you missed this week on EMP.';
      const subject = 'Your weekly EMP digest';
      const text = `Hi ${username},\n\n${highlights}\n\nOpen EMP: ${digestUrl}`;
      const html = layout(
        subject,
        `<p>Hi ${username},</p>
<p>${highlights}</p>
${button(digestUrl, 'Open EMP')}
<p style="font-size:13px;color:#666">You're receiving this because you're subscribed to weekly digests.</p>`,
      );
      return { subject, html, text };
    }

    default: {
      const exhaustive: never = templateId;
      throw new Error(`Unknown email template: ${exhaustive}`);
    }
  }
}
