import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(rateLimit, {
    max: 300,           // 300 req/min per user (global default for GET routes)
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use authenticated user ID if available, otherwise fall back to IP
      const user = (request as any).user;
      return user?.sub || request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        details: [],
      },
    }),
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
