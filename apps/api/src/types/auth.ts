import 'fastify';

export interface TokenPayload {
  sub: string;
  email: string;
  fullName: string;
  tenantId: string;
  role: string;
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
