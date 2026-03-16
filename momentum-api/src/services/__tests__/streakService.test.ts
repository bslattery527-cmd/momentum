import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStreak, updateStreak } from '../streakService';

const NOW = new Date('2026-03-15T12:00:00.000Z');

describe('streakService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a new streak when none exists', async () => {
    const upsert = vi.fn().mockResolvedValue({ currentStreak: 1, longestStreak: 1 });
    const tx = {
      streak: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    } as any;

    await updateStreak('user-1', tx);

    expect(tx.streak.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: new Date('2026-03-15'),
      },
      update: {
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: new Date('2026-03-15'),
      },
    });
  });

  it('returns the existing streak unchanged when the user already logged today', async () => {
    const streak = {
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 7,
      lastLogDate: new Date('2026-03-15T02:00:00.000Z'),
    };
    const tx = {
      streak: {
        findUnique: vi.fn().mockResolvedValue(streak),
        update: vi.fn(),
      },
    } as any;

    const result = await updateStreak('user-1', tx);

    expect(result).toBe(streak);
    expect(tx.streak.update).not.toHaveBeenCalled();
  });

  it('increments the streak when the last log was yesterday', async () => {
    const update = vi.fn().mockResolvedValue({ currentStreak: 5, longestStreak: 5 });
    const tx = {
      streak: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'user-1',
          currentStreak: 4,
          longestStreak: 4,
          lastLogDate: new Date('2026-03-14T23:30:00.000Z'),
        }),
        update,
      },
    } as any;

    await updateStreak('user-1', tx);

    expect(update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        currentStreak: 5,
        longestStreak: 5,
        lastLogDate: new Date('2026-03-15'),
      },
    });
  });

  it('resets the streak when the last log is older than yesterday', async () => {
    const update = vi.fn().mockResolvedValue({ currentStreak: 1, longestStreak: 9 });
    const tx = {
      streak: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'user-1',
          currentStreak: 6,
          longestStreak: 9,
          lastLogDate: new Date('2026-03-10T09:00:00.000Z'),
        }),
        update,
      },
    } as any;

    await updateStreak('user-1', tx);

    expect(update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        currentStreak: 1,
        longestStreak: 9,
        lastLogDate: new Date('2026-03-15'),
      },
    });
  });

  it('returns a zeroed streak payload when no streak row exists', async () => {
    const prisma = {
      streak: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(getStreak(prisma, 'user-1')).resolves.toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastLogDate: null,
    });
  });
});
