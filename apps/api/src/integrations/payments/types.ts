/**
 * PaymentProvider seam — one interface for all online payment providers.
 * The default provider is `simulated` (honest SIMULATED labels, no real
 * money movement). Real drivers (Paystack) are enabled only via the
 * PAYMENT_PROVIDER env flag and require keys from the secret store.
 */

export interface ChargeInitInput {
  /** Our unique charge reference — also sent to the provider. */
  reference: string;
  /** Amount in MINOR units (e.g. KES cents). Never major units. */
  amountMinor: number;
  /** ISO 4217 currency, e.g. "KES". */
  currency: string;
  email?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
}

export interface ChargeInitResult {
  reference: string;
  /** URL the payer is redirected to (null for simulated/offline methods). */
  authorizationUrl: string | null;
  accessCode: string | null;
  /** True when no real provider was contacted. */
  simulated: boolean;
}

export type ProviderTxStatus = 'success' | 'failed' | 'pending' | 'abandoned' | 'reversed' | string;

export interface VerifiedTransaction {
  reference: string;
  status: ProviderTxStatus;
  /** Amount in minor units as confirmed by the provider. */
  amountMinor: number;
  /** ISO 4217 currency as confirmed by the provider. */
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** True only for drivers that move real money. */
  readonly live: boolean;
  initiateCharge(input: ChargeInitInput): Promise<ChargeInitResult>;
  /** Verify a provider webhook signature against the RAW request body. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
  /** Server-side verification of a transaction before marking anything paid. */
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
}
