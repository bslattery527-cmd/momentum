import { PrismaClient } from '../../generated/prisma/index.js';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Updates the user's streak record within a transaction.
 * Called inside a transaction on every POST /logs.
 *
 * Logic (from EDD Section 10.2):
 * - If no previous log or lastLogDate is null: set streak to 1
 * - If lastLogDate is today: no change (already logged today)
 * - If lastLogDate is yesterday: increment streak by 1
 * - If lastLogDate is older: reset streak to 1
 * - Always update longestStreak if currentStreak exceeds it
 */
export async function updateStreak(userId: string, tx: PrismaTransaction) {
  const today = new Date().toISOString().split('T')[0]; // UTC date string
  const streak = await tx.streak.findUnique({ where: { userId } });

  if (!streak || !streak.lastLogDate) {
    return tx.streak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: new Date(today),
      },
      update: {
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: new Date(today),
      },
    });
  }

  const last = streak.lastLogDate.toISOString().split('T')[0];
  if (last === today) return streak; // already logged today — no change

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newCurrent = last === yesterday ? streak.currentStreak + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestStreak);

  return tx.streak.update({
    where: { userId },
    data: {
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastLogDate: new Date(today),
    },
  });
}

/**
 * Get streak data for a user.
 */
export async function getStreak(prisma: PrismaClient, userId: string) {
  const streak = await prisma.streak.findUnique({
    where: { userId },
  });

  if (!streak) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastLogDate: null,
    };
  }

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastLogDate: streak.lastLogDate,
  };
}
