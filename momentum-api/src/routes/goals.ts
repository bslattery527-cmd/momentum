import type { FastifyPluginAsync } from 'fastify';
import { getCurrentGoal, createGoal } from '../services/goalService.js';
import { getStreak } from '../services/streakService.js';

const goalRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users/me/goals/current — Get active weekly goal
  fastify.get('/goals/current', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub;

    const goal = await getCurrentGoal(fastify.prisma, userId);

    if (!goal) {
      return reply.status(200).send({
        data: null,
      });
    }

    return reply.status(200).send({
      data: {
        id: goal.id,
        type: goal.type,
        target: goal.target,
        week_start: goal.weekStart.toISOString().split('T')[0],
        days_logged: goal.daysLogged,
        minutes_logged: goal.minutesLogged,
        is_completed: goal.isCompleted,
        created_at: goal.createdAt.toISOString(),
      },
    });
  });

  // POST /users/me/goals — Create or replace the active weekly goal
  fastify.post('/goals', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['type', 'target'],
        properties: {
          type: { type: 'string', enum: ['days', 'hours'] },
          target: { type: 'integer', minimum: 1, maximum: 168 }, // max 168 hours in a week
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { type, target } = request.body as { type: 'days' | 'hours'; target: number };

    // Validate target based on type
    if (type === 'days' && target > 7) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Days target cannot exceed 7',
          details: [],
        },
      });
    }

    const goal = await createGoal(fastify.prisma, userId, type, target);

    return reply.status(201).send({
      data: {
        id: goal.id,
        type: goal.type,
        target: goal.target,
        week_start: goal.weekStart.toISOString().split('T')[0],
        days_logged: goal.daysLogged,
        minutes_logged: goal.minutesLogged,
        is_completed: goal.isCompleted,
        created_at: goal.createdAt.toISOString(),
      },
    });
  });

  // GET /users/me/streak — Get streak data
  fastify.get('/streak', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub;

    const streak = await getStreak(fastify.prisma, userId);

    return reply.status(200).send({
      data: {
        current_streak: streak.currentStreak,
        longest_streak: streak.longestStreak,
        last_log_date: streak.lastLogDate
          ? streak.lastLogDate.toISOString().split('T')[0]
          : null,
      },
    });
  });
};

export default goalRoutes;
