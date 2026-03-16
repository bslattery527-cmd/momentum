import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

const helmetPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(helmet, {
    contentSecurityPolicy: false, // API-only, no HTML rendering
  });
};

export default fp(helmetPlugin, { name: 'helmet' });
