import { FastifyPluginAsync } from 'fastify';
import { sendNotification } from '../services/pushService';

const followRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /users/:username/follow — Follow a user
  fastify.post('/:username/follow', {
    onRequest: [fastify.authenticate],
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
    const followerId = request.user.sub;
    const { username } = request.params as { username: string };

    const targetUser = await fastify.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    if (targetUser.id === followerId) {
      return reply.status(422).send({
        error: { code: 'UNPROCESSABLE', message: 'You cannot follow yourself', details: [] },
      });
    }

    // Check if already following
    const existing = await fastify.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUser.id,
        },
      },
    });

    if (existing) {
      return reply.status(409).send({
        error: { code: 'CONFLICT', message: 'Already following this user', details: [] },
      });
    }

    await fastify.prisma.follow.create({
      data: {
        followerId,
        followingId: targetUser.id,
      },
    });

    // Send follow notification (fire and forget)
    sendNotification(fastify.prisma, {
      type: 'follow',
      actorId: followerId,
      recipientId: targetUser.id,
    }).catch((err) => console.error('Follow notification error:', err));

    return reply.status(201).send({
      data: { message: 'Successfully followed user' },
    });
  });

  // DELETE /users/:username/follow — Unfollow a user
  fastify.delete('/:username/follow', {
    onRequest: [fastify.authenticate],
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
    const followerId = request.user.sub;
    const { username } = request.params as { username: string };

    const targetUser = await fastify.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    const existing = await fastify.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUser.id,
        },
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Not following this user', details: [] },
      });
    }

    await fastify.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUser.id,
        },
      },
    });

    return reply.status(204).send();
  });

  // GET /users/:username/followers — List followers
  fastify.get('/:username/followers', {
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
          cursor: { type: 'string' },
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
      select: { id: true },
    });

    if (!user) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    const where: any = { followingId: user.id };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const follows = await fastify.prisma.follow.findMany({
      where,
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = follows.length > limit;
    const results = hasMore ? follows.slice(0, limit) : follows;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    return reply.status(200).send({
      data: results.map((f) => ({
        id: f.follower.id,
        username: f.follower.username,
        display_name: f.follower.displayName,
        avatar_url: f.follower.avatarUrl,
        bio: f.follower.bio,
        followed_at: f.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });

  // GET /users/:username/following — List following
  fastify.get('/:username/following', {
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
          cursor: { type: 'string' },
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
      select: { id: true },
    });

    if (!user) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: [] },
      });
    }

    const where: any = { followerId: user.id };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const follows = await fastify.prisma.follow.findMany({
      where,
      include: {
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = follows.length > limit;
    const results = hasMore ? follows.slice(0, limit) : follows;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    return reply.status(200).send({
      data: results.map((f) => ({
        id: f.following.id,
        username: f.following.username,
        display_name: f.following.displayName,
        avatar_url: f.following.avatarUrl,
        bio: f.following.bio,
        followed_at: f.createdAt.toISOString(),
      })),
      meta: {
        has_more: hasMore,
        cursor: nextCursor,
      },
    });
  });
};

export default followRoutes;
