import { FastifyPluginAsync } from 'fastify';
import { sendNotification } from '../services/pushService';

const commentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /logs/:id/comments — Get comments for a log (oldest-first)
  fastify.get('/logs/:id/comments', {
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
          cursor: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const { id: logId } = request.params as { id: string };
    const { limit = 20, cursor } = request.query as {
      limit?: number;
      cursor?: string;
    };
    const authUserId = request.user?.sub;

    // Verify log exists and is accessible
    const log = await fastify.prisma.log.findUnique({
      where: { id: logId },
      select: { id: true, isPublished: true, userId: true },
    });

    if (!log) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    if (!log.isPublished && log.userId !== authUserId) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    const where: any = { logId };
    if (cursor) {
      where.createdAt = { gt: new Date(cursor) }; // oldest-first, so cursor goes forward
    }

    const comments = await fastify.prisma.comment.findMany({
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
      orderBy: { createdAt: 'asc' }, // oldest first
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const results = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    return reply.status(200).send({
      data: results.map((c) => ({
        id: c.id,
        log_id: c.logId,
        user: {
          id: c.user.id,
          username: c.user.username,
          display_name: c.user.displayName,
          avatar_url: c.user.avatarUrl,
        },
        body: c.body,
        created_at: c.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // POST /logs/:id/comments — Post a comment
  fastify.post('/logs/:id/comments', {
    onRequest: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
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
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 500 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { id: logId } = request.params as { id: string };
    const userId = request.user.sub;
    const { body: commentBody } = request.body as { body: string };

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

    const comment = await fastify.prisma.comment.create({
      data: {
        logId,
        userId,
        body: commentBody,
      },
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
    });

    // Send comment notification (fire and forget)
    sendNotification(fastify.prisma, {
      type: 'comment',
      actorId: userId,
      recipientId: log.userId,
      entityType: 'log',
      entityId: logId,
    }).catch((err) => console.error('Comment notification error:', err));

    return reply.status(201).send({
      data: {
        id: comment.id,
        log_id: comment.logId,
        user: {
          id: comment.user.id,
          username: comment.user.username,
          display_name: comment.user.displayName,
          avatar_url: comment.user.avatarUrl,
        },
        body: comment.body,
        created_at: comment.createdAt.toISOString(),
      },
    });
  });

  // DELETE /comments/:id — Delete a comment (author or log owner)
  fastify.delete('/comments/:id', {
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
    const { id: commentId } = request.params as { id: string };
    const userId = request.user.sub;

    const comment = await fastify.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        log: { select: { userId: true } },
      },
    });

    if (!comment) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Comment not found', details: [] },
      });
    }

    // Only comment author or log owner can delete
    if (comment.userId !== userId && comment.log.userId !== userId) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own comments or comments on your logs',
          details: [],
        },
      });
    }

    await fastify.prisma.comment.delete({ where: { id: commentId } });

    return reply.status(204).send();
  });
};

export default commentRoutes;
