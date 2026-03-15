import { FastifyPluginAsync } from 'fastify';

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /notifications — Get notifications (paginated)
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          cursor: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { limit = 20, cursor } = request.query as {
      limit?: number;
      cursor?: string;
    };

    const where: any = { recipientId: userId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const notifications = await fastify.prisma.notification.findMany({
      where,
      include: {
        actor: {
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

    const hasMore = notifications.length > limit;
    const results = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    return reply.status(200).send({
      data: results.map((n) => ({
        id: n.id,
        type: n.type,
        actor: {
          id: n.actor.id,
          username: n.actor.username,
          display_name: n.actor.displayName,
          avatar_url: n.actor.avatarUrl,
        },
        entity_type: n.entityType,
        entity_id: n.entityId,
        is_read: n.isRead,
        created_at: n.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // GET /notifications/unread-count — Get unread notification count
  fastify.get('/unread-count', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub;

    const count = await fastify.prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });

    return reply.status(200).send({
      data: { unread_count: count },
    });
  });

  // PUT /notifications/:id/read — Mark one notification as read
  fastify.put('/:id/read', {
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
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const notification = await fastify.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Notification not found', details: [] },
      });
    }

    if (notification.recipientId !== userId) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Not your notification', details: [] },
      });
    }

    await fastify.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return reply.status(200).send({
      data: { message: 'Notification marked as read' },
    });
  });

  // PUT /notifications/read-all — Mark all as read
  fastify.put('/read-all', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub;

    await fastify.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return reply.status(200).send({
      data: { message: 'All notifications marked as read' },
    });
  });
};

export default notificationRoutes;
