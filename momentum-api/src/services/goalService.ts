import { PrismaClient } from '../../generated/prisma/index.js';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Get the Monday of the current ISO week (UTC).
 */
function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday;
}

/**
 * Updates the user's active weekly goal within a transaction.
 * Called on every POST /logs.
 *
 * - Increments days_logged (only once per calendar day)
 * - Adds total_duration minutes to minutes_logged
 * - Checks if the goal is completed
 */
export async function updateGoalProgress(
  userId: string,
  totalDurationSeconds: number,
  tx: PrismaTransaction,
) {
  const weekStart = getCurrentWeekStart();

  // Find the active (non-completed) goal for the current week
  const goal = await tx.goal.findFirst({
    where: {
      userId,
      isCompleted: false,
      weekStart: {
        gte: weekStart,
      },
    },
  });

  if (!goal) return null; // No active goal

  const today = new Date().toISOString().split('T')[0];
  const totalMinutes = Math.floor(totalDurationSeconds / 60);

  // Only increment days_logged if this is the first log of the day.
  // The current log is already created when this runs, so count > 1 means there was a previous one.
  const logsToday = await tx.log.count({
    where: {
      userId,
      createdAt: {
        gte: new Date(today + 'T00:00:00Z'),
        lt: new Date(today + 'T23:59:59.999Z'),
      },
    },
  });

  const isFirstLogToday = logsToday <= 1;

  const newDaysLogged = isFirstLogToday ? goal.daysLogged + 1 : goal.daysLogged;
  const newMinutesLogged = goal.minutesLogged + totalMinutes;

  // Check completion
  let isCompleted = false;
  if (goal.type === 'days' && newDaysLogged >= goal.target) {
    isCompleted = true;
  } else if (goal.type === 'hours' && newMinutesLogged >= goal.target * 60) {
    isCompleted = true;
  }

  return tx.goal.update({
    where: { id: goal.id },
    data: {
      daysLogged: newDaysLogged,
      minutesLogged: newMinutesLogged,
      isCompleted,
    },
  });
}

/**
 * Get the current active weekly goal for a user.
 */
export async function getCurrentGoal(prisma: PrismaClient, userId: string) {
  const weekStart = getCurrentWeekStart();

  return prisma.goal.findFirst({
    where: {
      userId,
      isCompleted: false,
      weekStart: {
        gte: weekStart,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Create or replace the active weekly goal.
 */
export async function createGoal(
  prisma: PrismaClient,
  userId: string,
  type: 'days' | 'hours',
  target: number,
) {
  const weekStart = getCurrentWeekStart();

  // Mark any existing active goals as completed (replaced)
  await prisma.goal.updateMany({
    where: {
      userId,
      isCompleted: false,
    },
    data: {
      isCompleted: true,
    },
  });

  // Calculate current progress for the week
  const todayStr = new Date().toISOString().split('T')[0];
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Count distinct days with logs this week
  const logsThisWeek = await prisma.log.findMany({
    where: {
      userId,
      createdAt: {
        gte: new Date(weekStartStr + 'T00:00:00Z'),
      },
    },
    select: {
      createdAt: true,
      totalDuration: true,
    },
  });

  const uniqueDays = new Set(
    logsThisWeek.map((l) => l.createdAt.toISOString().split('T')[0])
  );
  const totalMinutes = logsThisWeek.reduce(
    (sum, l) => sum + Math.floor(l.totalDuration / 60),
    0
  );

  const daysLogged = uniqueDays.size;
  const minutesLogged = totalMinutes;

  let isCompleted = false;
  if (type === 'days' && daysLogged >= target) {
    isCompleted = true;
  } else if (type === 'hours' && minutesLogged >= target * 60) {
    isCompleted = true;
  }

  return prisma.goal.create({
    data: {
      userId,
      type,
      target,
      weekStart,
      daysLogged,
      minutesLogged,
      isCompleted,
    },
  });
}
