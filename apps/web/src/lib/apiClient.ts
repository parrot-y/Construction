/**
 * Backwards-compatible alias — the request layer now lives in `./api`.
 * New code should import from `lib/api` directly; this file remains so
 * existing imports keep working until the P1.3 migration completes.
 */
export { api, ApiError, isApiError, apiErrorMessage, idempotencyKey } from './api';
export type { ApiErrorKind, RequestOptions } from './api';
