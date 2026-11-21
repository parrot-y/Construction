import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ChargeInitInput, ChargeInitResult, PaymentProvider, VerifiedTransaction } from './types';

/**
 * Paystack driver — TEST MODE ONLY until the owner approves live keys.
 *
 * - Secret key comes from PAYSTACK_SECRET_KEY (secret store / env), never
 *   hard-coded. PAYSTACK_BASE_URL allows pointing at a local fake server
 *   in tests; production default is https://api.paystack.co.
 * - Webhook signature: `x-paystack-signature` header = lowercase hex
 *   HMAC-SHA512 of the RAW request body keyed by the secret key.
 *   Ref: https://paystack.com/docs/payments/webhooks/#verify-webhook-signatures
 * - Amounts are MINOR units (e.g. KES cents → "amount": 15000000 = KES 150,000.00).
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';
  readonly live = true;

  constructor(
    private readonly secretKey: string,
    private readonly baseUrl: string = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async initiateCharge(input: ChargeInitInput): Promise<ChargeInitResult> {
    const res = await this.fetchImpl(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
    const body = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(`Paystack initialize failed: ${body.message || res.status}`);
    }
    return {
      reference: body.data.reference || input.reference,
      authorizationUrl: body.data.authorization_url ?? null,
      accessCode: body.data.access_code ?? null,
      simulated: false,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected = createHmac('sha512', this.secretKey).update(rawBody, 'utf8').digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey}` } },
    );
    const body = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { status?: string; amount?: number; currency?: string; reference?: string };
    };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(`Paystack verify failed: ${body.message || res.status}`);
    }
    return {
      reference: body.data.reference || reference,
      status: body.data.status || 'unknown',
      amountMinor: Number(body.data.amount ?? 0),
      currency: body.data.currency || '',
    };
  }
}
