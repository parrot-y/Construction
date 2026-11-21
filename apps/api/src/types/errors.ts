/**
 * Shape of domain errors thrown by route handlers (`throw { status, message }`)
 * and Prisma/system errors surfaced through catch blocks. Used to type catch
 * variables without `any`.
 */
export interface RouteError {
  status?: number;
  statusCode?: number;
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  meta?: unknown;
  [key: string]: unknown;
}
