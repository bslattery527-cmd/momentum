import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Layout,
} from '@/constants/theme';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { Notification, PaginationMeta } from '@/types';

interface NotificationsResponse {
  data: Notification[];
  meta: PaginationMeta;
}

/**
 * Format timestamp to a compact relative time.
 */
function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return 'now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

/**
 * Get the notification copy based on type.
 */
function getNotificationText(notification: Notification): string {
  const name = notification.actor.display_name;
  switch (notification.type) {
    case 'reaction':
      return `${name} celebrated your log`;
    case 'comment':
      return `${name} commented on your log`;
    case 'follow':
      return `${name} started following you`;
    case 'tag':
      return `${name} tagged you in a session`;
    default:
      return `${name} interacted with you`;
  }
}

/**
 * Get the notification icon based on type.
 */
function getNotificationIcon(
  type: Notification['type']
): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case 'reaction':
      return { name: 'heart', color: Colors.celebrate };
    case 'comment':
      return { name: 'chatbubble', color: Colors.info };
    case 'follow':
      return { name: 'person-add', color: Colors.primary };
    case 'tag':
      return { name: 'pricetag', color: Colors.success };
    default:
      return { name: 'notifications', color: Colors.textSecondary };
  }
}

export default function NotificationsScreen() {
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam;
      const response = await api.get('/notifications', { params });
      return response.data as NotificationsResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta?.has_more && lastPage.meta.cursor) {
        return lastPage.meta.cursor;
      }
      return undefined;
    },
    staleTime: 0, // Always refetch notifications
  });

  // ─── Mark As Read ──────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.put(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread-count'],
      });
    },
  });

  // ─── Mark All Read ─────────────────────────────────────────────────

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.put('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread-count'],
      });
    },
  });

  const notifications: Notification[] =
    data?.pages.flatMap((page) => page.data) || [];

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      // Mark as read
      if (!notification.is_read) {
        markReadMutation.mutate(notification.id);
      }

      // Navigate to relevant content
      if (notification.type === 'follow') {
        router.push(`/users/${notification.actor.username}`);
      } else if (notification.entity_type === 'log' && notification.entity_id) {
        router.push(`/logs/${notification.entity_id}`);
      }
    },
    [markReadMutation]
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => {
      const icon = getNotificationIcon(item.type);

      return (
        <Pressable
          style={[
            styles.notificationRow,
            !item.is_read && styles.unreadRow,
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {item.actor.avatar_url ? (
              <Image
                source={{ uri: item.actor.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {item.actor.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
              <Ionicons
                name={icon.name}
                size={10}
                color={Colors.textInverse}
              />
            </View>
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.notificationText} numberOfLines={2}>
              {getNotificationText(item)}
            </Text>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Unread dot */}
          {!item.is_read && <View style={styles.unreadDot} />}
        </Pressable>
      );
    },
    [handleNotificationPress]
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="notifications-off-outline"
          size={48}
          color={Colors.textTertiary}
        />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptySubtitle}>
          When someone celebrates your log or follows you, you'll see it here
        </Text>
      </View>
    );
  }, [isLoading]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Mark All Read ─────────────────────────────── */}
      {notifications.some((n) => !n.is_read) && (
        <View style={styles.markAllBar}>
          <Pressable
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            hitSlop={8}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  markAllBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    alignItems: 'flex-end',
  },
  markAllText: {
    ...Typography.smallMedium,
    color: Colors.primary,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  unreadRow: {
    backgroundColor: Colors.backgroundSecondary,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: Spacing.md,
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
    fontSize: 14,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  textContainer: {
    flex: 1,
  },
  notificationText: {
    ...Typography.body,
    color: Colors.text,
  },
  timeText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['6xl'],
    paddingHorizontal: Spacing['3xl'],
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingFooter: {
    paddingVertical: Spacing.xl,
  },
});
