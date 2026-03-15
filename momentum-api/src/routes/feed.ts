import { FastifyPluginAsync } from 'fastify';

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /feed — Home feed: published logs from followed users, reverse-chron
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

    // Get IDs of users the authenticated user follows
    const following = await fastify.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);

    // If user follows nobody, return empty feed
    if (followingIds.length === 0) {
      return reply.status(200).send({
        data: [],
        meta: { has_more: false, cursor: null },
      });
    }

    const where: any = {
      userId: { in: followingIds },
      isPublished: true,
    };

    if (cursor) {
      where.publishedAt = { lt: new Date(cursor) };
    }

    const logs = await fastify.prisma.log.findMany({
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
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { reactions: true, comments: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].publishedAt?.toISOString() ?? null
      : null;

    // Batch check if user has reacted to any of these logs
    const logIds = results.map((l) => l.id);
    const userReactions = await fastify.prisma.reaction.findMany({
      where: {
        logId: { in: logIds },
        userId,
      },
      select: { logId: true },
    });
    const reactedLogIds = new Set(userReactions.map((r) => r.logId));

    // Get streak info for each log author
    const authorIds = [...new Set(results.map((l) => l.userId))];
    const streaks = await fastify.prisma.streak.findMany({
      where: { userId: { in: authorIds } },
    });
    const streakMap = new Map(streaks.map((s) => [s.userId, s.currentStreak]));

    const data = results.map((log) => ({
      id: log.id,
      user: {
        id: log.user.id,
        username: log.user.username,
        display_name: log.user.displayName,
        avatar_url: log.user.avatarUrl,
      },
      title: log.title,
      note: log.note,
      total_duration: log.totalDuration,
      tasks: log.tasks.map((t) => ({
        id: t.id,
        task_name: t.taskName,
        category_id: t.categoryId,
        category: { id: t.category.id, name: t.category.name, icon: t.category.icon },
        duration: t.duration,
        sort_order: t.sortOrder,
      })),
      images: log.images.map((img) => ({
        id: img.id,
        public_url: img.publicUrl,
        width: img.width,
        height: img.height,
        sort_order: img.sortOrder,
      })),
      reaction_count: log._count.reactions,
      comment_count: log._count.comments,
      has_reacted: reactedLogIds.has(log.id),
      published_at: log.publishedAt?.toISOString() ?? null,
      streak_at_time: streakMap.get(log.userId) ?? 0,
      created_at: log.createdAt.toISOString(),
    }));

    return reply.status(200).send({
      data,
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // GET /feed/explore — Explore: recent public logs from non-followed users
  fastify.get('/explore', {
    onRequest: [fastify.optionalAuth],
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
    const authUserId = request.user?.sub;
    const { limit = 20, cursor } = request.query as {
      limit?: number;
      cursor?: string;
    };

    const where: any = {
      isPublished: true,
    };

    // If authenticated, exclude followed users and self
    if (authUserId) {
      const following = await fastify.prisma.follow.findMany({
        where: { followerId: authUserId },
        select: { followingId: true },
      });
      const excludeIds = [authUserId, ...following.map((f) => f.followingId)];
      where.userId = { notIn: excludeIds };
    }

    if (cursor) {
      where.publishedAt = { lt: new Date(cursor) };
    }

    const logs = await fastify.prisma.log.findMany({
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
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { reactions: true, comments: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].publishedAt?.toISOString() ?? null
      : null;

    // Check reactions if authenticated
    let reactedLogIds = new Set<string>();
    if (authUserId) {
      const logIds = results.map((l) => l.id);
      const userReactions = await fastify.prisma.reaction.findMany({
        where: { logId: { in: logIds }, userId: authUserId },
        select: { logId: true },
      });
      reactedLogIds = new Set(userReactions.map((r) => r.logId));
    }

    const authorIds = [...new Set(results.map((l) => l.userId))];
    const streaks = await fastify.prisma.streak.findMany({
      where: { userId: { in: authorIds } },
    });
    const streakMap = new Map(streaks.map((s) => [s.userId, s.currentStreak]));

    const data = results.map((log) => ({
      id: log.id,
      user: {
        id: log.user.id,
        username: log.user.username,
        display_name: log.user.displayName,
        avatar_url: log.user.avatarUrl,
      },
      title: log.title,
      note: log.note,
      total_duration: log.totalDuration,
      tasks: log.tasks.map((t) => ({
        id: t.id,
        task_name: t.taskName,
        category_id: t.categoryId,
        category: { id: t.category.id, name: t.category.name, icon: t.category.icon },
        duration: t.duration,
        sort_order: t.sortOrder,
      })),
      images: log.images.map((img) => ({
        id: img.id,
        public_url: img.publicUrl,
        width: img.width,
        height: img.height,
        sort_order: img.sortOrder,
      })),
      reaction_count: log._count.reactions,
      comment_count: log._count.comments,
      has_reacted: reactedLogIds.has(log.id),
      published_at: log.publishedAt?.toISOString() ?? null,
      streak_at_time: streakMap.get(log.userId) ?? 0,
      created_at: log.createdAt.toISOString(),
    }));

    return reply.status(200).send({
      data,
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });
};

export default feedRoutes;
