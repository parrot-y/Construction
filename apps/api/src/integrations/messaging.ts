/**
 * Outbound messaging providers — Africa's Talking SMS + Meta WhatsApp
 * Cloud API + Resend email. All config is env-only (never stored in DB,
 * never logged). Unconfigured providers return SIMULATED so callers can
 * mark delivery honestly instead of pretending.
 *
 * Kenya-integrations skill rules applied:
 *  - sandbox/staging first; live creds are owner-approved later
 *  - phone numbers normalized to 254…; never log full numbers or tokens
 *  - failures are returned, not thrown, so callers can dead-letter
 */

export interface SendResult {
  ok: boolean;
  simulated: boolean; // true = no provider configured, nothing sent
  provider: string;
  reference?: string;  // provider message id / transaction id
  error?: string;
}

const SIMULATED: SendResult = { ok: true, simulated: true, provider: 'none' };

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 4 ? `***${digits.slice(-4)}` : '***';
}

export function normalizeKePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

// ---------------------------------------------------------------- SMS

export function smsConfig() {
  return {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || '',
    senderId: process.env.AT_SENDER_ID || '',
  };
}

export async function sendSms(to: string, message: string): Promise<SendResult> {
  const cfg = smsConfig();
  if (!cfg.apiKey || !cfg.username) return { ...SIMULATED, provider: 'africastalking' };

  const phone = normalizeKePhone(to);
  try {
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey: cfg.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        username: cfg.username,
        to: phone,
        message,
        ...(cfg.senderId ? { from: cfg.senderId } : {}),
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json.SMSMessageData?.Recipients?.[0]?.statusCode !== 101) {
      return { ok: false, simulated: false, provider: 'africastalking', error: `HTTP ${res.status}` };
    }
    return {
      ok: true, simulated: false, provider: 'africastalking',
      reference: json.SMSMessageData.Recipients[0].messageId,
    };
  } catch (err: any) {
    return { ok: false, simulated: false, provider: 'africastalking', error: err?.message || 'network error' };
  }
}

// ------------------------------------------------------------ WhatsApp

export function whatsappConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  };
}

export async function sendWhatsApp(to: string, message: string): Promise<SendResult> {
  const cfg = whatsappConfig();
  if (!cfg.token || !cfg.phoneNumberId) return { ...SIMULATED, provider: 'whatsapp' };

  const phone = normalizeKePhone(to);
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, simulated: false, provider: 'whatsapp', error: `HTTP ${res.status}` };
    }
    return { ok: true, simulated: false, provider: 'whatsapp', reference: json.messages?.[0]?.id };
  } catch (err: any) {
    return { ok: false, simulated: false, provider: 'whatsapp', error: err?.message || 'network error' };
  }
}

// ---------------------------------------------------------------- Email

export function emailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || '',
  };
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<SendResult> {
  const cfg = emailConfig();
  if (!cfg.apiKey || !cfg.from) return { ...SIMULATED, provider: 'resend' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, text, ...(html ? { html } : {}) }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, simulated: false, provider: 'resend', error: `HTTP ${res.status}` };
    }
    return { ok: true, simulated: false, provider: 'resend', reference: json.id };
  } catch (err: any) {
    return { ok: false, simulated: false, provider: 'resend', error: err?.message || 'network error' };
  }
}

// ------------------------------------------------------- Unified dispatch

export type NotifyChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';

export async function dispatchNotification(opts: {
  channel: NotifyChannel;
  to: string;
  subject?: string;
  body: string;
}): Promise<SendResult> {
  switch (opts.channel) {
    case 'SMS': return sendSms(opts.to, opts.body);
    case 'WHATSAPP': return sendWhatsApp(opts.to, opts.body);
    case 'EMAIL': return sendEmail(opts.to, opts.subject || 'Notification', opts.body);
  }
}

export function maskRecipient(to: string): string {
  return maskPhone(to);
}

// ------------------------------------------------------- Status for UI

export interface IntegrationStatus {
  provider: string;
  channel: NotifyChannel;
  configured: boolean;
  envVars: string[];
  webhookHint?: string;
}

export function integrationStatuses(baseUrl: string): IntegrationStatus[] {
  const wa = whatsappConfig();
  const sms = smsConfig();
  const em = emailConfig();
  return [
    {
      provider: 'WhatsApp Business (Meta Cloud API)', channel: 'WHATSAPP',
      configured: Boolean(wa.token && wa.phoneNumberId),
      envVars: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
      webhookHint: `${baseUrl}/api/v1/webhooks/whatsapp`,
    },
    {
      provider: "Africa's Talking SMS", channel: 'SMS',
      configured: Boolean(sms.apiKey && sms.username),
      envVars: ['AT_API_KEY', 'AT_USERNAME', 'AT_SENDER_ID'],
    },
    {
      provider: 'Resend Email', channel: 'EMAIL',
      configured: Boolean(em.apiKey && em.from),
      envVars: ['RESEND_API_KEY', 'EMAIL_FROM'],
    },
    {
      provider: 'M-Pesa Daraja (B2C payouts)', channel: 'SMS',
      configured: Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET),
      envVars: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL'],
    },
    {
      provider: 'KRA eTIMS', channel: 'EMAIL',
      configured: Boolean(process.env.ETIMS_VSCU_PIN && process.env.ETIMS_VSCU_PASSWORD),
      envVars: ['ETIMS_VSCU_PIN', 'ETIMS_VSCU_PASSWORD', 'ETIMS_ENVIRONMENT'],
    },
  ];
}
