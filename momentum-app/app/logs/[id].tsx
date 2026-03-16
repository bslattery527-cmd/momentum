import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
} from '@/constants/theme';
import { useLogDetail } from '@/hooks/useFeed';
import { ImageGrid } from '@/components/feed/ImageGrid';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import type { Comment, Log } from '@/types';

/**
 * Format duration in seconds to human-readable string.
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompactLayout = width < 768;

  const {
    data: log,
    isLoading,
    refetch,
  } = useLogDetail(id || '');

  // Fetch comments
  const {
    data: comments,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => {
      const response = await api.get(`/logs/${id}/comments`);
      const data = response.data;
      // Handle both paginated and flat response
      return (Array.isArray(data) ? data : (data as any).data || []) as Comment[];
    },
    enabled: !!id,
  });

  // ─── Celebrate Mutation ──────────────────────────────────────────

  const [hasReacted, setHasReacted] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);

  // Sync from log data — the API returns has_reacted on the log detail endpoint
  React.useEffect(() => {
    if (log) {
      setReactionCount(log.reaction_count);
      setHasReacted((log as any).has_reacted ?? false);
    }
  }, [log]);

  const celebrateMutation = useMutation({
    mutationFn: async ({ prevReacted }: { prevReacted: boolean; prevCount: number }) => {
      if (prevReacted) {
        await api.delete(`/logs/${id}/reactions`);
      } else {
        await api.post(`/logs/${id}/reactions`);
      }
    },
    onMutate: ({
      prevReacted,
      prevCount,
    }: {
      prevReacted: boolean;
      prevCount: number;
    }) => {
      setHasReacted(!prevReacted);
      setReactionCount(prevReacted ? Math.max(0, prevCount - 1) : prevCount + 1);

      return { prevReacted, prevCount };
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      setHasReacted(context.prevReacted);
      setReactionCount(context.prevCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleCelebratePress = useCallback(() => {
    celebrateMutation.mutate({
      prevReacted: hasReacted,
      prevCount: reactionCount,
    });
  }, [celebrateMutation, hasReacted, reactionCount]);

  // ─── Delete Log Mutation ──────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Could not delete this log. Please try again.');
    },
  });

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this log? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  }, [deleteMutation]);

  const handleUserPress = useCallback(
    (username: string) => {
      router.push(`/users/${username}`);
    },
    []
  );

  const handleRefresh = useCallback(() => {
    refetch();
    refetchComments();
  }, [refetch, refetchComments]);

  const isOwner = user?.id === log?.user_id;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!log) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Log not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Log Detail',
          headerShown: !isCompactLayout,
          headerBackTitle: 'Back',
          headerRight: () =>
            isOwner ? (
              <Pressable onPress={handleDelete} hitSlop={12}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={Colors.error}
                />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isCompactLayout && styles.contentCompact,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {isCompactLayout && (
          <View
            style={[
              styles.mobileTopBar,
              { paddingTop: insets.top + Spacing.sm },
            ]}
          >
            <Pressable onPress={() => router.back()} style={styles.mobileTopAction}>
              <Ionicons
                name="chevron-back"
                size={20}
                color={Colors.text}
              />
              <Text style={styles.mobileTopActionText}>Back</Text>
            </Pressable>

            {isOwner ? (
              <Pressable onPress={handleDelete} style={styles.mobileTopIconButton}>
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={Colors.error}
                />
              </Pressable>
            ) : (
              <View style={styles.mobileTopSpacer} />
            )}
          </View>
        )}

        {/* ─── Title & Meta ────────────────────────────────── */}
        <Text style={styles.title}>{log.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>
            {formatDate(log.created_at)}
          </Text>
        </View>

        {log.started_at && log.ended_at && (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>
              {formatTime(log.started_at)} - {formatTime(log.ended_at)}
            </Text>
          </View>
        )}

        <View style={styles.durationCard}>
          <Ionicons name="timer-outline" size={20} color={Colors.primary} />
          <Text style={styles.durationValue}>
            {formatDuration(log.total_duration)}
          </Text>
          <Text style={styles.durationLabel}>total duration</Text>
        </View>

        {/* ─── Note ────────────────────────────────────────── */}
        {log.note && (
          <View style={styles.noteSection}>
            <Text style={styles.noteText}>{log.note}</Text>
          </View>
        )}

        {/* ─── Tasks ───────────────────────────────────────── */}
        {log.tasks && log.tasks.length > 0 && (
          <View style={styles.tasksSection}>
            <Text style={styles.sectionLabel}>Tasks</Text>
            {log.tasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskInfo}>
                  {task.category?.icon && (
                    <Text style={styles.taskIcon}>{task.category.icon}</Text>
                  )}
                  <Text style={styles.taskName}>{task.task_name}</Text>
                </View>
                <Text style={styles.taskDuration}>
                  {formatDuration(task.duration)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Images ──────────────────────────────────────── */}
        {log.images && log.images.length > 0 && (
          <View style={styles.imagesSection}>
            <ImageGrid images={log.images} />
          </View>
        )}

        {/* ─── Tagged Users ────────────────────────────────── */}
        {log.tagged_users && log.tagged_users.length > 0 && (
          <View style={styles.taggedSection}>
            <Text style={styles.sectionLabel}>Tagged</Text>
            <View style={styles.taggedUsers}>
              {log.tagged_users.map((taggedUser) => (
                <Pressable
                  key={taggedUser.id}
                  style={styles.taggedUser}
                  onPress={() => handleUserPress(taggedUser.username)}
                >
                  {taggedUser.avatar_url ? (
                    <Image
                      source={{ uri: taggedUser.avatar_url }}
                      style={styles.taggedAvatar}
                    />
                  ) : (
                    <View style={[styles.taggedAvatar, styles.taggedAvatarPlaceholder]}>
                      <Text style={styles.taggedAvatarInitial}>
                        {taggedUser.display_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.taggedName}>
                    @{taggedUser.username}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ─── Actions (Celebrate) ─────────────────────────── */}
        <View style={styles.actionsSection}>
          <Pressable
            style={[
              styles.celebrateButton,
              hasReacted && styles.celebrateButtonActive,
            ]}
            onPress={handleCelebratePress}
            disabled={celebrateMutation.isPending}
          >
            <Text style={{ fontSize: 18 }}>{'\u{1F44F}'}</Text>
            <Text
              style={[
                styles.celebrateText,
                hasReacted && styles.celebrateTextActive,
              ]}
            >
              {hasReacted ? 'Clapped' : 'Clap'}{' '}
              {reactionCount > 0 ? `(${reactionCount})` : ''}
            </Text>
          </Pressable>
        </View>

        {/* ─── Comments ────────────────────────────────────── */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionLabel}>
            Comments{' '}
            {comments && comments.length > 0 ? `(${comments.length})` : ''}
          </Text>

          {commentsLoading ? (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={styles.commentsLoading}
            />
          ) : comments && comments.length > 0 ? (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <Pressable
                  onPress={() => handleUserPress(comment.user.username)}
                >
                  {comment.user.avatar_url ? (
                    <Image
                      source={{ uri: comment.user.avatar_url }}
                      style={styles.commentAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.commentAvatar,
                        styles.commentAvatarPlaceholder,
                      ]}
                    >
                      <Text style={styles.commentAvatarInitial}>
                        {comment.user.display_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Pressable
                      onPress={() => handleUserPress(comment.user.username)}
                    >
                      <Text style={styles.commentAuthor}>
                        {comment.user.display_name}
                      </Text>
                    </Pressable>
                    <Text style={styles.commentTime}>
                      {timeAgo(comment.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.commentBody}>{comment.body}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noComments}>
              No comments yet. Be the first to celebrate this session!
            </Text>
          )}
        </View>

        {/* ─── Visibility Info ─────────────────────────────── */}
        <View style={styles.visibilityRow}>
          <Ionicons
            name={log.is_published ? 'globe-outline' : 'lock-closed-outline'}
            size={14}
            color={Colors.textTertiary}
          />
          <Text style={styles.visibilityText}>
            {log.is_published ? 'Published to feed' : 'Private log'}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['6xl'],
  },
  contentCompact: {
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  backLink: {
    marginTop: Spacing.md,
  },
  backLinkText: {
    ...Typography.bodyMedium,
    color: Colors.primary,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  mobileTopAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  mobileTopActionText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  mobileTopIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  mobileTopSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  metaText: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  durationValue: {
    ...Typography.h3,
    color: Colors.text,
  },
  durationLabel: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  noteSection: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  noteText: {
    ...Typography.body,
    color: Colors.text,
    lineHeight: 24,
  },
  tasksSection: {
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  taskIcon: {
    fontSize: 16,
  },
  taskName: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  taskDuration: {
    ...Typography.bodySemibold,
    color: Colors.primary,
  },
  imagesSection: {
    marginTop: Spacing.xl,
  },
  taggedSection: {
    marginTop: Spacing.xl,
  },
  taggedUsers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  taggedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  taggedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  taggedAvatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taggedAvatarInitial: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  taggedName: {
    ...Typography.small,
    color: Colors.text,
  },
  actionsSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  celebrateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  celebrateButtonActive: {
    borderColor: Colors.celebrate,
    backgroundColor: Colors.celebrateLight,
  },
  celebrateText: {
    ...Typography.buttonSmall,
    color: Colors.textSecondary,
  },
  celebrateTextActive: {
    color: Colors.celebrate,
  },
  commentsSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  commentsLoading: {
    paddingVertical: Spacing.lg,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  commentAvatar: {
    width: Layout.avatarSizeSm,
    height: Layout.avatarSizeSm,
    borderRadius: Layout.avatarSizeSm / 2,
    marginRight: Spacing.md,
  },
  commentAvatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    ...Typography.smallMedium,
    color: Colors.text,
  },
  commentTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  commentBody: {
    ...Typography.body,
    color: Colors.text,
  },
  noComments: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['3xl'],
    gap: Spacing.xs,
  },
  visibilityText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
