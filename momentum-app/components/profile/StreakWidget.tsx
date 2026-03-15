import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/constants/theme';

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Displays the user's current streak and longest streak.
 * Shown on profile screens.
 */
export function StreakWidget({ currentStreak, longestStreak }: StreakWidgetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flame" size={20} color={Colors.streak} />
        <Text style={styles.headerText}>Streak</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentStreak}</Text>
          <Text style={styles.statLabel}>Current</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Text style={[styles.statValue, styles.statValueSecondary]}>
            {longestStreak}
          </Text>
          <Text style={styles.statLabel}>Longest</Text>
        </View>
      </View>

      {currentStreak > 0 && (
        <View style={styles.motivationRow}>
          <Text style={styles.motivationText}>
            {currentStreak >= longestStreak && currentStreak > 1
              ? 'New personal best! Keep it going!'
              : currentStreak === 1
                ? 'Great start! Come back tomorrow to keep the streak.'
                : `${longestStreak - currentStreak} more day${longestStreak - currentStreak === 1 ? '' : 's'} to beat your record!`}
          </Text>
        </View>
      )}

      {currentStreak === 0 && (
        <View style={styles.motivationRow}>
          <Text style={styles.motivationText}>
            Log a session today to start a new streak!
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerText: {
    ...Typography.h4,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.streak,
    lineHeight: 38,
  },
  statValueSecondary: {
    color: Colors.textSecondary,
  },
  statLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  motivationRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  motivationText: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
