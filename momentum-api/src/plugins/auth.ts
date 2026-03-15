import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { JwtPayload } from '../lib/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    optionalAuth: (request: FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fjwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  });

  /**
   * Decorator that enforces authentication.
   * Throws 401 if no valid token is present.
   */
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch (err) {
      const error = new Error('Invalid or expired access token') as any;
      error.statusCode = 401;
      throw error;
    }
  });

  /**
   * Decorator for optional authentication.
   * Sets request.user if a valid token is present, otherwise leaves it undefined.
   */
  fastify.decorate('optionalAuth', async function (request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch {
      // Silently ignore — user remains unauthenticated
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
