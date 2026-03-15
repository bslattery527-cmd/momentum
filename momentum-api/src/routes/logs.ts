import { FastifyPluginAsync } from 'fastify';
import { updateStreak } from '../services/streakService';
import { updateGoalProgress } from '../services/goalService';
import { validateImageUploads, reserveImageUploads, commitImagesToLog, deleteS3Objects } from '../services/imageService';
import { sendNotification } from '../services/pushService';

const logRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /logs — Create a new work log
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 hour',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['title', 'tasks'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          note: { type: 'string', maxLength: 280 },
          is_published: { type: 'boolean', default: false },
          started_at: { type: 'string', format: 'date-time' },
          ended_at: { type: 'string', format: 'date-time' },
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: {
              type: 'object',
              required: ['task_name', 'category_id', 'duration'],
              properties: {
                task_name: { type: 'string', minLength: 1, maxLength: 200 },
                category_id: { type: 'string', format: 'uuid' },
                duration: { type: 'integer', minimum: 1 },
              },
              additionalProperties: false,
            },
          },
          tagged_user_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            maxItems: 10,
          },
          image_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            maxItems: 4,
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const body = request.body as {
      title: string;
      note?: string;
      is_published?: boolean;
      started_at?: string;
      ended_at?: string;
      tasks: Array<{ task_name: string; category_id: string; duration: number }>;
      tagged_user_ids?: string[];
      image_ids?: string[];
    };

    // Calculate total duration from tasks
    const totalDuration = body.tasks.reduce((sum, t) => sum + t.duration, 0);
    const isPublished = body.is_published ?? false;
    const now = new Date();

    // Create log within a transaction to ensure streak + goal updates are atomic
    const log = await fastify.prisma.$transaction(async (tx) => {
      // Create the log
      const newLog = await tx.log.create({
        data: {
          userId,
          title: body.title,
          note: body.note || null,
          totalDuration,
          startedAt: body.started_at ? new Date(body.started_at) : null,
          endedAt: body.ended_at ? new Date(body.ended_at) : null,
          isPublished,
          publishedAt: isPublished ? now : null,
        },
      });

      // Create log tasks
      await tx.logTask.createMany({
        data: body.tasks.map((t, i) => ({
          logId: newLog.id,
          categoryId: t.category_id,
          taskName: t.task_name,
          duration: t.duration,
          sortOrder: i,
        })),
      });

      // Handle tagged users
      if (body.tagged_user_ids && body.tagged_user_ids.length > 0) {
        await tx.logTaggedUser.createMany({
          data: body.tagged_user_ids.map((uid) => ({
            logId: newLog.id,
            userId: uid,
          })),
          skipDuplicates: true,
        });
      }

      // Commit images if provided
      if (body.image_ids && body.image_ids.length > 0) {
        // Verify all images exist and are pending
        const pendingImages = await tx.logImage.findMany({
          where: {
            id: { in: body.image_ids },
            logId: null,
          },
        });

        if (pendingImages.length !== body.image_ids.length) {
          throw new Error('One or more image IDs are invalid or already committed');
        }

        for (let i = 0; i < body.image_ids.length; i++) {
          await tx.logImage.update({
            where: { id: body.image_ids[i] },
            data: { logId: newLog.id, sortOrder: i },
          });
        }
      }

      // Update streak
      await updateStreak(userId, tx as any);

      // Update goal progress
      await updateGoalProgress(userId, totalDuration, tx as any);

      return newLog;
    });

    // Fetch the complete log with relations
    const fullLog = await fastify.prisma.log.findUnique({
      where: { id: log.id },
      include: {
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        taggedUsers: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { reactions: true, comments: true },
        },
      },
    });

    // Send tag notifications (fire and forget)
    if (body.tagged_user_ids && body.tagged_user_ids.length > 0) {
      for (const taggedId of body.tagged_user_ids) {
        sendNotification(fastify.prisma, {
          type: 'tag',
          actorId: userId,
          recipientId: taggedId,
          entityType: 'log',
          entityId: log.id,
        }).catch((err) => console.error('Tag notification error:', err));
      }
    }

    return reply.status(201).send({
      data: {
        id: fullLog!.id,
        user_id: fullLog!.userId,
        title: fullLog!.title,
        note: fullLog!.note,
        total_duration: fullLog!.totalDuration,
        started_at: fullLog!.startedAt?.toISOString() ?? null,
        ended_at: fullLog!.endedAt?.toISOString() ?? null,
        is_published: fullLog!.isPublished,
        published_at: fullLog!.publishedAt?.toISOString() ?? null,
        tasks: fullLog!.tasks.map((t) => ({
          id: t.id,
          task_name: t.taskName,
          category_id: t.categoryId,
          category: { id: t.category.id, name: t.category.name, icon: t.category.icon },
          duration: t.duration,
          sort_order: t.sortOrder,
        })),
        images: fullLog!.images.map((img) => ({
          id: img.id,
          public_url: img.publicUrl,
          width: img.width,
          height: img.height,
          sort_order: img.sortOrder,
        })),
        tagged_users: fullLog!.taggedUsers.map((tu) => ({
          id: tu.user.id,
          username: tu.user.username,
          display_name: tu.user.displayName,
          avatar_url: tu.user.avatarUrl,
        })),
        reaction_count: fullLog!._count.reactions,
        comment_count: fullLog!._count.comments,
        created_at: fullLog!.createdAt.toISOString(),
      },
    });
  });

  // GET /logs/:id
  fastify.get('/:id', {
    onRequest: [fastify.optionalAuth],
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
    const { id } = request.params as { id: string };
    const authUserId = request.user?.sub;

    const log = await fastify.prisma.log.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        taggedUsers: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { reactions: true, comments: true },
        },
      },
    });

    if (!log) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    // Authorization: only owner can see private logs
    if (!log.isPublished && log.userId !== authUserId) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    // Check if current user has reacted
    let hasReacted = false;
    if (authUserId) {
      const reaction = await fastify.prisma.reaction.findUnique({
        where: {
          logId_userId: { logId: id, userId: authUserId },
        },
      });
      hasReacted = !!reaction;
    }

    return reply.status(200).send({
      data: {
        id: log.id,
        user_id: log.userId,
        user: {
          id: log.user.id,
          username: log.user.username,
          display_name: log.user.displayName,
          avatar_url: log.user.avatarUrl,
        },
        title: log.title,
        note: log.note,
        total_duration: log.totalDuration,
        started_at: log.startedAt?.toISOString() ?? null,
        ended_at: log.endedAt?.toISOString() ?? null,
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
          public_url: img.publicUrl,
          width: img.width,
          height: img.height,
          sort_order: img.sortOrder,
        })),
        tagged_users: log.taggedUsers.map((tu) => ({
          id: tu.user.id,
          username: tu.user.username,
          display_name: tu.user.displayName,
          avatar_url: tu.user.avatarUrl,
        })),
        reaction_count: log._count.reactions,
        comment_count: log._count.comments,
        has_reacted: hasReacted,
        created_at: log.createdAt.toISOString(),
      },
    });
  });

  // PUT /logs/:id — Update a log (owner only)
  fastify.put('/:id', {
    onRequest: [fastify.authenticate],
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
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          note: { type: ['string', 'null'], maxLength: 280 },
          is_published: { type: 'boolean' },
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: {
              type: 'object',
              required: ['task_name', 'category_id', 'duration'],
              properties: {
                task_name: { type: 'string', minLength: 1, maxLength: 200 },
                category_id: { type: 'string', format: 'uuid' },
                duration: { type: 'integer', minimum: 1 },
              },
              additionalProperties: false,
            },
          },
          tagged_user_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            maxItems: 10,
          },
          image_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            maxItems: 4,
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.sub;
    const body = request.body as {
      title?: string;
      note?: string | null;
      is_published?: boolean;
      tasks?: Array<{ task_name: string; category_id: string; duration: number }>;
      tagged_user_ids?: string[];
      image_ids?: string[];
    };

    const existingLog = await fastify.prisma.log.findUnique({ where: { id } });
    if (!existingLog) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }
    if (existingLog.userId !== userId) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'You can only edit your own logs', details: [] },
      });
    }

    const now = new Date();
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.is_published !== undefined) {
      updateData.isPublished = body.is_published;
      if (body.is_published && !existingLog.publishedAt) {
        updateData.publishedAt = now;
      }
    }

    await fastify.prisma.$transaction(async (tx) => {
      // Update log fields
      if (Object.keys(updateData).length > 0) {
        await tx.log.update({ where: { id }, data: updateData });
      }

      // Replace tasks if provided
      if (body.tasks) {
        await tx.logTask.deleteMany({ where: { logId: id } });
        const totalDuration = body.tasks.reduce((sum, t) => sum + t.duration, 0);
        await tx.logTask.createMany({
          data: body.tasks.map((t, i) => ({
            logId: id,
            categoryId: t.category_id,
            taskName: t.task_name,
            duration: t.duration,
            sortOrder: i,
          })),
        });
        await tx.log.update({ where: { id }, data: { totalDuration } });
      }

      // Replace tagged users if provided
      if (body.tagged_user_ids !== undefined) {
        await tx.logTaggedUser.deleteMany({ where: { logId: id } });
        if (body.tagged_user_ids.length > 0) {
          await tx.logTaggedUser.createMany({
            data: body.tagged_user_ids.map((uid) => ({
              logId: id,
              userId: uid,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Commit new images if provided
      if (body.image_ids && body.image_ids.length > 0) {
        for (let i = 0; i < body.image_ids.length; i++) {
          await tx.logImage.update({
            where: { id: body.image_ids[i] },
            data: { logId: id, sortOrder: i },
          });
        }
      }
    });

    // Fetch updated log
    const updatedLog = await fastify.prisma.log.findUnique({
      where: { id },
      include: {
        tasks: {
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        taggedUsers: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { reactions: true, comments: true } },
      },
    });

    return reply.status(200).send({
      data: {
        id: updatedLog!.id,
        user_id: updatedLog!.userId,
        title: updatedLog!.title,
        note: updatedLog!.note,
        total_duration: updatedLog!.totalDuration,
        is_published: updatedLog!.isPublished,
        published_at: updatedLog!.publishedAt?.toISOString() ?? null,
        tasks: updatedLog!.tasks.map((t) => ({
          id: t.id,
          task_name: t.taskName,
          category_id: t.categoryId,
          category: { id: t.category.id, name: t.category.name, icon: t.category.icon },
          duration: t.duration,
          sort_order: t.sortOrder,
        })),
        images: updatedLog!.images.map((img) => ({
          id: img.id,
          public_url: img.publicUrl,
          width: img.width,
          height: img.height,
          sort_order: img.sortOrder,
        })),
        tagged_users: updatedLog!.taggedUsers.map((tu) => ({
          id: tu.user.id,
          username: tu.user.username,
          display_name: tu.user.displayName,
          avatar_url: tu.user.avatarUrl,
        })),
        reaction_count: updatedLog!._count.reactions,
        comment_count: updatedLog!._count.comments,
        created_at: updatedLog!.createdAt.toISOString(),
      },
    });
  });

  // DELETE /logs/:id — Delete a log (owner only)
  fastify.delete('/:id', {
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
    const { id } = request.params as { id: string };
    const userId = request.user.sub;

    const log = await fastify.prisma.log.findUnique({
      where: { id },
      include: { images: { select: { s3Key: true } } },
    });

    if (!log) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Log not found', details: [] },
      });
    }

    if (log.userId !== userId) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'You can only delete your own logs', details: [] },
      });
    }

    // Delete the log (cascades to tasks, images, reactions, comments, tagged users)
    await fastify.prisma.log.delete({ where: { id } });

    // Async cleanup of S3 objects
    if (log.images.length > 0) {
      deleteS3Objects(log.images.map((img) => img.s3Key)).catch((err) =>
        console.error('S3 cleanup error:', err)
      );
    }

    return reply.status(204).send();
  });

  // POST /logs/image-upload — Get pre-signed S3 URLs for image upload
  fastify.post('/image-upload', {
    onRequest: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 hour',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['mime_type', 'file_size'],
              properties: {
                mime_type: {
                  type: 'string',
                  enum: ['image/jpeg', 'image/png', 'image/webp'],
                },
                file_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 10485760, // 10 MB
                },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { images } = request.body as {
      images: Array<{ mime_type: string; file_size: number }>;
    };

    const validationError = validateImageUploads(images);
    if (validationError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError,
          details: [],
        },
      });
    }

    try {
      const results = await reserveImageUploads(fastify.prisma, userId, images);
      return reply.status(201).send({ data: results });
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate upload URLs',
          details: [],
        },
      });
    }
  });
};

export default logRoutes;
