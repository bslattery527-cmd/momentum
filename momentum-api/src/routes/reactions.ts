import type { FastifyPluginAsync } from 'fastify';
import { sendNotification } from '../services/pushService.js';

const reactionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /logs/:id/reactions — Celebrate a log
  fastify.post('/:id/reactions', {
    onRequest: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 hour',
      },
    },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { id: logId } = request.params as { id: string };
    const userId = request.user.sub;

    // Verify log exists and is published
    const log = await fastify.prisma.log.findUnique({
      where: { id: logId },
      select: { id: true, userId: true, isPublished: true },
    });

    if (!log) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    if (!log.isPublished) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    // Check for existing reaction
    const existing = await fastify.prisma.reaction.findUnique({
      where: {
        logId_userId: { logId, userId },
      },
    });

    if (existing) {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'Already reacted to this log', details: [] },
      });
    }

    await fastify.prisma.reaction.create({
      data: { logId, userId },
    });

    // Send reaction notification (fire and forget)
    sendNotification(fastify.prisma, {
      type: 'reaction',
      actorId: userId,
      recipientId: log.userId,
      entityType: 'log',
      entityId: logId,
    }).catch((err) => console.error('Reaction notification error:', err));

    return reply.status(201).send({
      data: { message: 'Reaction added' },
    });
  });

  // DELETE /logs/:id/reactions — Remove reaction
  fastify.delete('/:id/reactions', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { id: logId } = request.params as { id: string };
    const userId = request.user.sub;

    const existing = await fastify.prisma.reaction.findUnique({
      where: {
        logId_userId: { logId, userId },
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Reaction not found', details: [] },
      });
    }

    await fastify.prisma.reaction.delete({
      where: {
        logId_userId: { logId, userId },
      },
    });

    return reply.status(204).send();
  });

  // GET /logs/:id/reactions — List users who celebrated
  fastify.get('/:id/reactions', {
    onRequest: [fastify.optionalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          cursor: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id: logId } = request.params as { id: string };
    const { limit = 20, cursor } = request.query as {
      limit?: number;
      cursor?: string;
    };

    // Verify log exists and is published
    const log = await fastify.prisma.log.findUnique({
      where: { id: logId },
      select: { id: true, isPublished: true, userId: true },
    });

    if (!log) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    const authUserId = request.user?.sub;
    if (!log.isPublished && log.userId !== authUserId) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    const where: any = { logId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const reactions = await fastify.prisma.reaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = reactions.length > limit;
    const results = hasMore ? reactions.slice(0, limit) : reactions;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    return reply.status(200).send({
      data: results.map((r) => ({
        id: r.user.id,
        username: r.user.username,
        display_name: r.user.displayName,
        avatar_url: r.user.avatarUrl,
        reacted_at: r.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });
};

export default reactionRoutes;
