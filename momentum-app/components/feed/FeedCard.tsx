import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
} from '@/constants/theme';
import { ImageGrid } from './ImageGrid';
import type { FeedItem } from '@/types';

interface FeedCardProps {
  item: FeedItem;
  onCelebrate?: (logId: string, hasReacted: boolean) => void;
}

/**
 * Format duration in seconds to a human-readable string.
 * e.g. 3600 => "1h", 5400 => "1h 30m", 900 => "15m"
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '<1m';
}

/**
 * Format a timestamp to a relative time string.
 * e.g. "2m ago", "3h ago", "2d ago"
 */
function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return 'just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export function FeedCard({ item, onCelebrate }: FeedCardProps) {
  const clapScale = useRef(new Animated.Value(1)).current;
  const clapRotate = useRef(new Animated.Value(0)).current;

  const handleUserPress = useCallback(() => {
    router.push(`/users/${item.user.username}`);
  }, [item.user.username]);

  const handleCardPress = useCallback(() => {
    router.push(`/logs/${item.id}`);
  }, [item.id]);

  const handleCelebrate = useCallback(() => {
    // Clap animation on celebrate
    if (!item.has_reacted) {
      clapRotate.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(clapScale, {
            toValue: 1.4,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(clapScale, {
            toValue: 1,
            friction: 3,
            tension: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(clapRotate, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(clapRotate, {
            toValue: -0.5,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(clapRotate, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
    onCelebrate?.(item.id, item.has_reacted);
  }, [item.id, item.has_reacted, onCelebrate, clapScale, clapRotate]);

  const handleCommentPress = useCallback(() => {
    router.push(`/logs/${item.id}`);
  }, [item.id]);

  return (
    <Pressable
      style={styles.card}
      onPress={handleCardPress}
      accessibilityLabel={`Open log ${item.title}`}
      nativeID={Platform.OS === 'web' ? `feed-card-${item.id}` : undefined}
      testID={`feed-card-${item.id}`}
      dataSet={Platform.OS === 'web' ? { testid: `feed-card-${item.id}` } : undefined}
      {...(Platform.OS === 'web' ? ({ id: `feed-card-${item.id}` } as any) : {})}
    >
      {/* ─── User Info Row ───────────────────────────────── */}
      <View style={styles.userRow}>
        <Pressable onPress={handleUserPress} style={styles.userInfo}>
          {item.user.avatar_url ? (
            <Image
              source={{ uri: item.user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {item.user.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userText}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.user.display_name}
            </Text>
            <Text style={styles.usernameTime}>
              @{item.user.username} · {timeAgo(item.published_at || item.created_at)}
            </Text>
          </View>
        </Pressable>

        {item.streak_at_time != null && item.streak_at_time > 1 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
              {item.streak_at_time}
            </Text>
            <Ionicons name="flame" size={14} color={Colors.streak} />
          </View>
        )}
      </View>

      {/* ─── Log Content ─────────────────────────────────── */}
      <Text style={styles.title}>{item.title}</Text>

      {item.note && (
        <Text style={styles.note} numberOfLines={3}>
          {item.note}
        </Text>
      )}

      {/* ─── Duration ────────────────────────────────────── */}
      <View style={styles.durationRow}>
        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.durationText}>
          {formatDuration(item.total_duration)}
        </Text>
      </View>

      {/* ─── Task Pills ──────────────────────────────────── */}
      {item.tasks && item.tasks.length > 0 && (
        <View style={styles.taskPills}>
          {item.tasks.map((task) => (
            <View key={task.id} style={styles.taskPill}>
              {task.category?.icon && (
                <Text style={styles.taskIcon}>{task.category.icon}</Text>
              )}
              <Text style={styles.taskName} numberOfLines={1}>
                {task.task_name}
              </Text>
              <Text style={styles.taskDuration}>
                {formatDuration(task.duration)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ─── Image Grid ──────────────────────────────────── */}
      {item.images && item.images.length > 0 && (
        <ImageGrid images={item.images} />
      )}

      {/* ─── Action Bar ──────────────────────────────────── */}
      <View style={styles.actionBar}>
        <Pressable
          onPress={handleCelebrate}
          style={[
            styles.actionButton,
            item.has_reacted && styles.actionButtonActive,
          ]}
          hitSlop={8}
          nativeID={Platform.OS === 'web' ? `celebrate-${item.id}` : undefined}
          accessibilityLabel={
            item.has_reacted
              ? `Remove celebration from ${item.title}`
              : `Celebrate ${item.title}`
          }
          dataSet={Platform.OS === 'web' ? { testid: `celebrate-${item.id}` } : undefined}
          {...(Platform.OS === 'web' ? ({ id: `celebrate-${item.id}` } as any) : {})}
        >
          <Animated.Text
            style={{
              fontSize: 18,
              transform: [
                { scale: clapScale },
                {
                  rotate: clapRotate.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ['-15deg', '0deg', '15deg'],
                  }),
                },
              ],
            }}
          >
            {'\u{1F44F}'}
          </Animated.Text>
          {item.reaction_count > 0 && (
            <Text
              style={[
                styles.actionCount,
                item.has_reacted && styles.actionCountActive,
              ]}
            >
              {item.reaction_count}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleCommentPress}
          style={styles.actionButton}
          hitSlop={8}
          nativeID={Platform.OS === 'web' ? `comment-${item.id}` : undefined}
          accessibilityLabel={`Open comments for ${item.title}`}
          dataSet={Platform.OS === 'web' ? { testid: `comment-${item.id}` } : undefined}
          {...(Platform.OS === 'web' ? ({ id: `comment-${item.id}` } as any) : {})}
        >
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color={Colors.textSecondary}
          />
          {item.comment_count > 0 && (
            <Text style={styles.actionCount}>{item.comment_count}</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Layout.cardPadding,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: Layout.avatarSizeMd,
    height: Layout.avatarSizeMd,
    borderRadius: Layout.avatarSizeMd / 2,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...Typography.bodySemibold,
    color: Colors.textInverse,
  },
  userText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  displayName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  usernameTime: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.streakLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  streakText: {
    ...Typography.smallMedium,
    color: Colors.streak,
    marginRight: 2,
  },
  title: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  note: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  durationText: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  taskPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  taskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  taskIcon: {
    fontSize: 12,
    marginRight: Spacing.xs,
  },
  taskName: {
    ...Typography.small,
    color: Colors.text,
    maxWidth: 120,
  },
  taskDuration: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    gap: Spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButtonActive: {
    backgroundColor: Colors.primaryLight ?? '#E8F0FE',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 16,
  },
  actionCount: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  actionCountActive: {
    color: Colors.celebrate,
  },
});
