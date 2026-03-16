import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoal, getCurrentGoal, updateGoalProgress } from '../goalService.js';

const NOW = new Date('2026-03-18T12:00:00.000Z');
const WEEK_START = new Date('2026-03-16T00:00:00.000Z');

describe('goalService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when there is no active goal for the current week', async () => {
    const tx = {
      goal: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(updateGoalProgress('user-1', 3600, tx)).resolves.toBeNull();
  });

  it('increments days and minutes on the first log of the day and completes a days goal', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'goal-1' });
    const tx = {
      goal: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'goal-1',
          userId: 'user-1',
          type: 'days',
          target: 3,
          daysLogged: 2,
          minutesLogged: 90,
          isCompleted: false,
        }),
        update,
      },
      log: {
        count: vi.fn().mockResolvedValue(1),
      },
    } as any;

    await updateGoalProgress('user-1', 1800, tx);

    expect(tx.goal.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isCompleted: false,
        weekStart: { gte: WEEK_START },
      },
    });
    expect(tx.log.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: {
          gte: new Date('2026-03-18T00:00:00Z'),
          lt: new Date('2026-03-18T23:59:59.999Z'),
        },
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'goal-1' },
      data: {
        daysLogged: 3,
        minutesLogged: 120,
        isCompleted: true,
      },
    });
  });

  it('does not increment days twice in a day and completes an hours goal when minutes cross the threshold', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'goal-1' });
    const tx = {
      goal: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'goal-1',
          userId: 'user-1',
          type: 'hours',
          target: 5,
          daysLogged: 2,
          minutesLogged: 295,
          isCompleted: false,
        }),
        update,
      },
      log: {
        count: vi.fn().mockResolvedValue(2),
      },
    } as any;

    await updateGoalProgress('user-1', 600, tx);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'goal-1' },
      data: {
        daysLogged: 2,
        minutesLogged: 305,
        isCompleted: true,
      },
    });
  });

  it('queries the latest active goal in the current week', async () => {
    const prisma = {
      goal: {
        findFirst: vi.fn().mockResolvedValue({ id: 'goal-1' }),
      },
    } as any;

    await getCurrentGoal(prisma, 'user-1');

    expect(prisma.goal.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isCompleted: false,
        weekStart: { gte: WEEK_START },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('replaces the active goal and seeds progress from current-week logs', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: 'goal-2' });
    const prisma = {
      goal: {
        updateMany,
        create,
      },
      log: {
        findMany: vi.fn().mockResolvedValue([
          { createdAt: new Date('2026-03-16T09:00:00.000Z'), totalDuration: 3600 },
          { createdAt: new Date('2026-03-16T18:00:00.000Z'), totalDuration: 1800 },
          { createdAt: new Date('2026-03-17T08:00:00.000Z'), totalDuration: 7200 },
        ]),
      },
    } as any;

    await createGoal(prisma, 'user-1', 'hours', 2);

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isCompleted: false },
      data: { isCompleted: true },
    });
    expect(prisma.log.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: {
          gte: new Date('2026-03-16T00:00:00Z'),
        },
      },
      select: {
        createdAt: true,
        totalDuration: true,
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'hours',
        target: 2,
        weekStart: WEEK_START,
        daysLogged: 2,
        minutesLogged: 210,
        isCompleted: true,
      },
    });
  });
});
