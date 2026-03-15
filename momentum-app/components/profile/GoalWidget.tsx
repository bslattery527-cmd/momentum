import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/constants/theme';
import type { Goal } from '@/types';

interface GoalWidgetProps {
  goal: Goal | null | undefined;
  onSetGoal?: () => void;
  compact?: boolean;
}

/**
 * Displays weekly goal progress or a CTA to set a goal.
 * Used on the home feed (compact) and profile screen (full).
 */
export function GoalWidget({ goal, onSetGoal, compact = false }: GoalWidgetProps) {
  const handleSetGoal = useCallback(() => {
    onSetGoal?.();
  }, [onSetGoal]);

  if (!goal) {
    return (
      <Pressable
        style={[styles.container, compact && styles.containerCompact]}
        onPress={handleSetGoal}
      >
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={24} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Set a weekly goal</Text>
          <Text style={styles.emptySubtitle}>
            Track your progress and stay consistent
          </Text>
        </View>
      </Pressable>
    );
  }

  const progress = goal.type === 'days'
    ? goal.days_logged / goal.target
    : goal.minutes_logged / (goal.target * 60);
  const progressPercent = Math.min(progress, 1);
  const progressDisplay = goal.type === 'days'
    ? `${goal.days_logged} of ${goal.target} days`
    : `${Math.round(goal.minutes_logged / 60)} of ${goal.target} hours`;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={goal.is_completed ? 'trophy' : 'trophy-outline'}
            size={20}
            color={goal.is_completed ? Colors.celebrate : Colors.primary}
          />
          <Text style={styles.headerText}>Weekly Goal</Text>
        </View>
        {goal.is_completed && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.completedText}>Done!</Text>
          </View>
        )}
      </View>

      <Text style={styles.progressLabel}>{progressDisplay}</Text>

      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${progressPercent * 100}%`,
              backgroundColor: goal.is_completed
                ? Colors.success
                : Colors.primary,
            },
          ]}
        />
      </View>

      {!compact && goal.is_completed && (
        <View style={styles.celebrationRow}>
          <Text style={styles.celebrationText}>
            Goal achieved! Great work this week.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  containerCompact: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    ...Typography.h4,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  completedText: {
    ...Typography.captionMedium,
    color: Colors.success,
    marginLeft: 4,
  },
  progressLabel: {
    ...Typography.bodyMedium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  emptyTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  celebrationRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  celebrationText: {
    ...Typography.small,
    color: Colors.success,
    textAlign: 'center',
  },
});
