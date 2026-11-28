import { simulatedProvider } from './simulated';
import { PaystackProvider } from './paystack';
import type { PaymentProvider } from './types';

export * from './types';
export { simulatedProvider } from './simulated';
export { PaystackProvider } from './paystack';

/**
 * Provider selection — feature flag PAYMENT_PROVIDER:
 *   unset / "simulated" → simulatedProvider (default, no real money)
 *   "paystack"          → PaystackProvider; requires PAYSTACK_SECRET_KEY
 *                         from the environment/secret store. Missing key is
 *                         a loud config error, never a silent fallback.
 */
export function getPaymentProvider(): PaymentProvider {
  const flag = (process.env.PAYMENT_PROVIDER || 'simulated').trim().toLowerCase();
  if (flag === 'simulated' || flag === '') return simulatedProvider;
  if (flag === 'paystack') {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new Error('PAYMENT_PROVIDER=paystack requires PAYSTACK_SECRET_KEY (secret store)');
    }
    return new PaystackProvider(secret);
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${flag}" — supported: simulated, paystack`);
}
