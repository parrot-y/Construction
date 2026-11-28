import type { ChargeInitInput, ChargeInitResult, PaymentProvider, VerifiedTransaction } from './types';

/**
 * Default provider: honest SIMULATED behaviour. Charge initiation returns a
 * simulated result so the UI can render the flow, but no money moves and no
 * webhook exists. Kept as the default so nothing touches real providers
 * until PAYMENT_PROVIDER is explicitly set.
 */
export const simulatedProvider: PaymentProvider = {
  name: 'simulated',
  live: false,

  async initiateCharge(input: ChargeInitInput): Promise<ChargeInitResult> {
    return {
      reference: input.reference,
      authorizationUrl: null,
      accessCode: null,
      simulated: true,
    };
  },

  verifyWebhookSignature(): boolean {
    return false;
  },

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    throw new Error(`Simulated provider cannot verify transaction ${reference}`);
  },
};
