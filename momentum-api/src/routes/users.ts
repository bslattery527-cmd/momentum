import type { FastifyPluginAsync } from 'fastify';
import { getAvatarUploadUrl, getPublicObjectUrl } from '../services/imageService.js';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users/me
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub;

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      include: {
        streak: true,
        _count: {
          select: {
            follows: true,    // following count
            followers: true,  // follower count
            logs: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    return reply.status(200).send({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        bio: user.bio,
        goal_category: user.goalCategory,
        follower_count: user._count.followers,
        following_count: user._count.follows,
        log_count: user._count.logs,
        current_streak: user.streak?.currentStreak ?? 0,
        longest_streak: user.streak?.longestStreak ?? 0,
        created_at: user.createdAt.toISOString(),
      },
    });
  });

  // PUT /users/me
  fastify.put('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          display_name: { type: 'string', minLength: 1, maxLength: 100 },
          bio: { type: ['string', 'null'], maxLength: 160 },
          avatar_url: { type: ['string', 'null'] },
          goal_category: { type: ['string', 'null'] },
          username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-z0-9_]{3,30}$' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const body = request.body as {
      display_name?: string;
      bio?: string | null;
      avatar_url?: string | null;
      goal_category?: string | null;
      username?: string;
    };

    // If username is being changed, validate uniqueness
    if (body.username) {
      if (!USERNAME_REGEX.test(body.username)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Username must be 3-30 characters, lowercase alphanumeric and underscores only',
            details: [],
          },
        });
      }

      const existing = await fastify.prisma.user.findUnique({
        where: { username: body.username },
      });
      if (existing && existing.id !== userId) {
        return reply.status(409).send({
          error: { code: 'CONFLICT', message: 'Username is already taken', details: [] },
        });
      }
    }

    const updateData: any = {};
    if (body.display_name !== undefined) updateData.displayName = body.display_name;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.avatar_url !== undefined) updateData.avatarUrl = body.avatar_url;
    if (body.goal_category !== undefined) updateData.goalCategory = body.goal_category;
    if (body.username !== undefined) updateData.username = body.username;

    const user = await fastify.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return reply.status(200).send({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        bio: user.bio,
        goal_category: user.goalCategory,
        created_at: user.createdAt.toISOString(),
      },
    });
  });

  // GET /users/search
  fastify.get('/search', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          cursor: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { q, limit = 20, cursor } = request.query as {
      q: string;
      limit?: number;
      cursor?: string;
    };

    const where: any = {
      isActive: true,
      OR: [
        { username: { contains: q.toLowerCase(), mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    };

    if (cursor) {
      where.id = { lt: cursor };
    }

    const users = await fastify.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = users.length > limit;
    const results = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return reply.status(200).send({
      data: results.map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.displayName,
        avatar_url: u.avatarUrl,
        bio: u.bio,
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // GET /users/:username
  fastify.get('/:username', {
    onRequest: [fastify.optionalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const authUserId = request.user?.sub;

    const user = await fastify.prisma.user.findUnique({
      where: { username },
      include: {
        streak: true,
        _count: {
          select: {
            follows: true,
            followers: true,
            logs: {
              where: { isPublished: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    // Check if authenticated user is following this profile
    let isFollowing = false;
    if (authUserId && authUserId !== user.id) {
      const follow = await fastify.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: authUserId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    const responseData: any = {
      id: user.id,
      username: user.username,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      bio: user.bio,
      follower_count: user._count.followers,
      following_count: user._count.follows,
      current_streak: user.streak?.currentStreak ?? 0,
      longest_streak: user.streak?.longestStreak ?? 0,
      log_count: user._count.logs,
    };

    if (authUserId) {
      responseData.is_following = isFollowing;
    }

    return reply.status(200).send({ data: responseData });
  });

  // GET /users/me/logs — Get own full log history (public + private)
  fastify.get('/me/logs', {
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

    const where: any = { userId };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const logs = await fastify.prisma.log.findMany({
      where,
      include: {
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { reactions: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    // Check reactions if authenticated
    const logIds = results.map((l) => l.id);
    let reactedLogIds = new Set<string>();
    const userReactions = await fastify.prisma.reaction.findMany({
      where: { logId: { in: logIds }, userId },
      select: { logId: true },
    });
    reactedLogIds = new Set(userReactions.map((r) => r.logId));

    return reply.status(200).send({
      data: results.map((log) => ({
        id: log.id,
        user_id: log.userId,
        title: log.title,
        note: log.note,
        total_duration: log.totalDuration,
        is_published: log.isPublished,
        published_at: log.publishedAt?.toISOString() ?? null,
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
          public_url: getPublicObjectUrl(img.s3Key),
          width: img.width,
          height: img.height,
          sort_order: img.sortOrder,
        })),
        reaction_count: log._count.reactions,
        comment_count: log._count.comments,
        has_reacted: reactedLogIds.has(log.id),
        created_at: log.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // GET /users/:username/logs — Get a user's public log history
  fastify.get('/:username/logs', {
    onRequest: [fastify.optionalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string' },
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
    const { username } = request.params as { username: string };
    const { limit = 20, cursor } = request.query as {
      limit?: number;
      cursor?: string;
    };

    const user = await fastify.prisma.user.findUnique({
      where: { username },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    const where: any = {
      userId: user.id,
      isPublished: true, // Only show published logs for other users
    };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const authUserId = request.user?.sub;

    const logs = await fastify.prisma.log.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { reactions: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
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

    return reply.status(200).send({
      data: results.map((log) => ({
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
        is_published: log.isPublished,
        published_at: log.publishedAt?.toISOString() ?? null,
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
          public_url: getPublicObjectUrl(img.s3Key),
          width: img.width,
          height: img.height,
          sort_order: img.sortOrder,
        })),
        reaction_count: log._count.reactions,
        comment_count: log._count.comments,
        has_reacted: reactedLogIds.has(log.id),
        created_at: log.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // POST /users/me/avatar-upload
  fastify.post('/me/avatar-upload', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['mime_type', 'file_size'],
        properties: {
          mime_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
          file_size: { type: 'integer', minimum: 1, maximum: 10485760 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { mime_type, file_size } = request.body as {
      mime_type: string;
      file_size: number;
    };

    try {
      const result = await getAvatarUploadUrl(userId, mime_type, file_size);
      return reply.status(201).send({ data: result });
    } catch (err: any) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          details: [],
        },
      });
    }
  });

  // POST /users/me/push-token
  fastify.post('/me/push-token', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['token', 'platform'],
        properties: {
          token: { type: 'string', minLength: 1 },
          platform: { type: 'string', enum: ['ios', 'android'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { token, platform } = request.body as { token: string; platform: string };

    // Upsert push token — a token can only belong to one user
    const existing = await fastify.prisma.pushToken.findUnique({
      where: { token },
    });

    if (existing) {
      if (existing.userId === userId) {
        // Token already registered for this user
        return reply.status(200).send({ data: { message: 'Push token already registered' } });
      }
      // Transfer token to current user (device changed hands)
      await fastify.prisma.pushToken.update({
        where: { token },
        data: { userId, platform },
      });
    } else {
      await fastify.prisma.pushToken.create({
        data: { userId, token, platform },
      });
    }

    return reply.status(201).send({ data: { message: 'Push token registered' } });
  });

  // DELETE /users/me/push-token
  fastify.delete('/me/push-token', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { token } = request.body as { token: string };

    await fastify.prisma.pushToken.deleteMany({
      where: { userId, token },
    });

    return reply.status(200).send({ data: { message: 'Push token removed' } });
  });
};

export default userRoutes;
