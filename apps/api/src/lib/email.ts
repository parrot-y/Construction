/**
 * Transactional email seam (staging hardening).
 *
 * EMAIL_DRIVER:
 *   simulated (default, dev/e2e) — accepts the message, returns ok+simulated,
 *     logs only subject/recipient-domain (never bodies or tokens).
 *   resend — Resend HTTP API (RESEND_API_KEY + EMAIL_FROM).
 *   ses — AWS SESv2 (SES_REGION + SES_FROM); uses the task IAM role, no keys.
 *
 * Used for verify-email, password-reset and invitation emails. When no real
 * driver is configured the message is honestly marked simulated — the
 * operator activation path remains the fallback for account access.
 */

export interface EmailResult {
  ok: boolean;
  simulated: boolean;
  provider: string;
  reference?: string;
  error?: string;
}

export interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function emailDriver(): 'simulated' | 'resend' | 'ses' {
  const d = (process.env.EMAIL_DRIVER || '').toLowerCase();
  if (d === 'resend' || d === 'ses') return d;
  // Auto-detect: explicit creds imply intent even without EMAIL_DRIVER.
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return 'resend';
  if (process.env.SES_FROM) return 'ses';
  return 'simulated';
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || process.env.SES_FROM || 'SiteSafi <no-reply@localhost>';
}

async function sendViaResend(mail: TransactionalEmail): Promise<EmailResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, simulated: false, provider: 'resend', error: `HTTP ${res.status}` };
    return { ok: true, simulated: false, provider: 'resend', reference: json.id };
  } catch (err: any) {
    return { ok: false, simulated: false, provider: 'resend', error: err?.message || 'network error' };
  }
}

async function sendViaSes(mail: TransactionalEmail): Promise<EmailResult> {
  try {
    const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
    const client = new SESv2Client({ region: process.env.SES_REGION || process.env.AWS_REGION || 'af-south-1' });
    const out = await client.send(new SendEmailCommand({
      FromEmailAddress: emailFrom(),
      Destination: { ToAddresses: [mail.to] },
      Content: {
        Simple: {
          Subject: { Data: mail.subject },
          Body: {
            Text: { Data: mail.text },
            ...(mail.html ? { Html: { Data: mail.html } } : {}),
          },
        },
      },
    }));
    return { ok: true, simulated: false, provider: 'ses', reference: out.MessageId };
  } catch (err: any) {
    return { ok: false, simulated: false, provider: 'ses', error: err?.message || 'ses error' };
  }
}

export async function sendTransactionalEmail(mail: TransactionalEmail): Promise<EmailResult> {
  const driver = emailDriver();
  if (driver === 'resend') return sendViaResend(mail);
  if (driver === 'ses') return sendViaSes(mail);
  // Simulated: accept honestly, expose nothing sensitive in logs.
  const domain = mail.to.split('@')[1] || 'unknown';
  console.log(`[email:simulated] to=*@${domain} subject=${JSON.stringify(mail.subject)}`);
  return { ok: true, simulated: true, provider: 'simulated' };
}
