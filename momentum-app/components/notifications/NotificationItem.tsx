import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMarkRead } from '@/hooks/useNotifications';
import { colors, spacing, typography } from '@/constants/theme';
import type { Notification } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w`;
}

function getNotificationMessage(notification: Notification): string {
  const actorName =
    notification.actor?.display_name ??
    notification.actor?.username ??
    'Someone';

  switch (notification.type) {
    case 'reaction':
      return `${actorName} clapped for your session`;
    case 'comment':
      return `${actorName} commented on your session`;
    case 'follow':
      return `${actorName} started following you`;
    case 'tag':
      return `${actorName} tagged you in a session`;
    default:
      return `${actorName} interacted with you`;
  }
}

function getNotificationIcon(type: string): {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  switch (type) {
    case 'reaction':
      return { name: 'hand-left', color: colors.celebrate };
    case 'comment':
      return { name: 'chatbubble', color: colors.info };
    case 'follow':
      return { name: 'person-add', color: colors.primary };
    case 'tag':
      return { name: 'pricetag', color: colors.success };
    default:
      return { name: 'notifications', color: colors.textSecondary };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationItem({
  notification,
}: NotificationItemProps) {
  const router = useRouter();
  const markRead = useMarkRead();

  const actor = notification.actor;
  const message = useMemo(
    () => getNotificationMessage(notification),
    [notification],
  );
  const icon = useMemo(
    () => getNotificationIcon(notification.type),
    [notification.type],
  );
  const time = useMemo(
    () => timeAgo(notification.created_at),
    [notification.created_at],
  );

  const handlePress = useCallback(() => {
    // Mark as read
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }

    // Navigate to the relevant entity
    if (notification.type === 'follow' && actor?.username) {
      router.push(`/users/${actor.username}`);
    } else if (notification.entity_type === 'log' && notification.entity_id) {
      router.push(`/logs/${notification.entity_id}`);
    } else if (
      notification.entity_type === 'comment' &&
      notification.entity_id
    ) {
      // Comments navigate to the parent log — entity_id might be the log ID
      // The backend should include the log ID somewhere; fallback to entity_id
      router.push(`/logs/${notification.entity_id}`);
    }
  }, [notification, actor, markRead, router]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.is_read && styles.containerUnread,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`${message}. ${time}`}
      accessibilityRole="button"
    >
      {/* Unread Indicator */}
      {!notification.is_read && <View style={styles.unreadDot} />}

      {/* Actor Avatar */}
      <View style={styles.avatarContainer}>
        {actor?.avatar_url ? (
          <Image source={{ uri: actor.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color={colors.textTertiary} />
          </View>
        )}
        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: icon.color }]}>
          <Ionicons name={icon.name} size={10} color="#FFF" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.message,
            !notification.is_read && styles.messageUnread,
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Text style={styles.time}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  containerUnread: {
    backgroundColor: colors.backgroundSecondary,
  },
  unreadDot: {
    position: 'absolute',
    left: spacing.xs,
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: -4,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  messageUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 12,
  },
});
