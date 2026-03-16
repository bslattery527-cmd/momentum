import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifySensible from '@fastify/sensible';

// Plugins
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import helmetPlugin from './plugins/helmet.js';
import rateLimitPlugin from './plugins/rateLimit.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import logRoutes from './routes/logs.js';
import feedRoutes from './routes/feed.js';
import followRoutes from './routes/follows.js';
import reactionRoutes from './routes/reactions.js';
import commentRoutes from './routes/comments.js';
import goalRoutes from './routes/goals.js';
import notificationRoutes from './routes/notifications.js';
import categoryRoutes from './routes/categories.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true,
        allErrors: true,
      },
    },
  });

  // ── Global error handler ──────────────────────────────────────────
  fastify.setErrorHandler((error: any, _request, reply) => {
    const statusCode = error.statusCode || 500;

    // Validation errors from Fastify/AJV
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation.map((v: any) => ({
            field: v.instancePath || v.params?.missingProperty || 'unknown',
            message: v.message || 'Invalid value',
          })),
        },
      });
    }

    // Rate limit errors
    if (statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message || 'Too many requests',
          details: [],
        },
      });
    }

    // Known HTTP errors
    if (statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: error.code || 'ERROR',
          message: error.message || 'An error occurred',
          details: [],
        },
      });
    }

    // Internal server errors — never expose stack traces
    fastify.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: [],
      },
    });
  });

  // ── Plugins ───────────────────────────────────────────────────────
  await fastify.register(fastifySensible);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);

  // ── Health check ──────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // ── API v1 Routes ─────────────────────────────────────────────────
  fastify.register(async (api) => {
    api.register(authRoutes, { prefix: '/auth' });
    api.register(userRoutes, { prefix: '/users' });
    api.register(logRoutes, { prefix: '/logs' });
    api.register(feedRoutes, { prefix: '/feed' });
    api.register(followRoutes, { prefix: '/users' });
    api.register(reactionRoutes, { prefix: '/logs' });
    api.register(commentRoutes);  // has its own /logs/:id/comments and /comments/:id prefixes
    api.register(goalRoutes, { prefix: '/users/me' });
    api.register(notificationRoutes, { prefix: '/notifications' });
    api.register(categoryRoutes, { prefix: '/categories' });
  }, { prefix: '/api/v1' });

  return fastify;
}
