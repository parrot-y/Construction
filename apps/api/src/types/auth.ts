import 'fastify';

export interface TokenPayload {
  sub: string;
  email: string;
  fullName: string;
  tenantId: string;
  role: string;
  /** 'access' tokens may call APIs; 'refresh' tokens only /auth/refresh. */
  typ?: 'access' | 'refresh';
  /** Refresh-token id — tracked server-side for rotation/reuse detection. */
  jti?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
