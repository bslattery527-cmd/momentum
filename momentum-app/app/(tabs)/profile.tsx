import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
} from '@/constants/theme';
import { useUserLogs, useStreak, useCurrentGoal } from '@/hooks/useFeed';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { StreakWidget } from '@/components/profile/StreakWidget';
import { GoalWidget } from '@/components/profile/GoalWidget';
import { api } from '@/lib/api';
import type { User, Log } from '@/types';

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

/**
 * Format a timestamp to a relative time string.
 */
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

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const logoutMutation = useLogout();
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  // Fetch full profile with follower/following counts
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const response = await api.get('/users/me');
      return response.data as User & {
        follower_count: number;
        following_count: number;
        log_count: number;
      };
    },
  });

  const { data: streak, refetch: refetchStreak } = useStreak();
  const { data: currentGoal, refetch: refetchGoal } = useCurrentGoal();
  const {
    data: logsData,
    isLoading: logsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchLogs,
  } = useUserLogs(user?.username || '', true);

  const logs: Log[] = logsData?.pages.flatMap((page) => page.data) || [];

  const handleRefresh = useCallback(() => {
    refetchProfile();
    refetchStreak();
    refetchGoal();
    refetchLogs();
  }, [refetchProfile, refetchStreak, refetchGoal, refetchLogs]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleLogPress = useCallback((logId: string) => {
    router.push(`/logs/${logId}`);
  }, []);

  // ─── Profile Header ───────────────────────────────────────────────

  const renderProfileHeader = useCallback(() => {
    const displayUser = profile || user;
    if (!displayUser) return null;

    return (
      <View style={styles.headerContainer}>
        {/* Avatar + Name */}
        <View style={styles.profileTopRow}>
          {displayUser.avatar_url ? (
            <Image
              source={{ uri: displayUser.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {displayUser.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(profile as any)?.log_count ?? 0}
              </Text>
              <Text style={styles.statLabel}>Logs</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(profile as any)?.follower_count ?? 0}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(profile as any)?.following_count ?? 0}
              </Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Name & Bio */}
        <View style={styles.nameSection}>
          <Text style={styles.displayName}>{displayUser.display_name}</Text>
          <Text style={styles.username}>@{displayUser.username}</Text>
          {displayUser.bio && (
            <Text style={styles.bio}>{displayUser.bio}</Text>
          )}
        </View>

        {/* Edit Profile & Logout */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={styles.logoutButton}
            onPress={() => setLogoutConfirmVisible(true)}
            disabled={logoutMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          </Pressable>
        </View>

        {/* ─── Streak Widget ──────────────────────────────── */}
        <View style={styles.widgetsSection}>
          <StreakWidget
            currentStreak={streak?.current_streak ?? 0}
            longestStreak={streak?.longest_streak ?? 0}
          />

          <View style={styles.widgetSpacer} />

          <GoalWidget goal={currentGoal} />
        </View>

        {/* ─── Log History Header ─────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Log History</Text>
        </View>
      </View>
    );
  }, [profile, user, streak, currentGoal, logoutMutation]);

  // ─── Log Item ──────────────────────────────────────────────────────

  const renderLogItem = useCallback(
    ({ item }: { item: Log }) => (
      <Pressable
        style={styles.logItem}
        onPress={() => handleLogPress(item.id)}
      >
        <View style={styles.logHeader}>
          <View style={styles.logTitleRow}>
            <Text style={styles.logTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_published && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={10} color={Colors.textSecondary} />
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            )}
          </View>
          <Text style={styles.logTime}>{timeAgo(item.created_at)}</Text>
        </View>

        {item.note && (
          <Text style={styles.logNote} numberOfLines={2}>
            {item.note}
          </Text>
        )}

        <View style={styles.logFooter}>
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.durationText}>
              {formatDuration(item.total_duration)}
            </Text>
          </View>

          {item.tasks && item.tasks.length > 0 && (
            <View style={styles.taskIndicator}>
              <Text style={styles.taskCount}>
                {item.tasks.length} task{item.tasks.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {item.is_published && (
            <View style={styles.socialStats}>
              {item.reaction_count > 0 && (
                <View style={styles.miniStat}>
                  <Ionicons name="heart" size={12} color={Colors.celebrate} />
                  <Text style={styles.miniStatText}>{item.reaction_count}</Text>
                </View>
              )}
              {item.comment_count > 0 && (
                <View style={styles.miniStat}>
                  <Ionicons
                    name="chatbubble"
                    size={12}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.miniStatText}>{item.comment_count}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    ),
    [handleLogPress]
  );

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

  const renderEmpty = useCallback(() => {
    if (logsLoading) return null;
    return (
      <View style={styles.emptyLogs}>
        <Ionicons name="document-text-outline" size={32} color={Colors.textTertiary} />
        <Text style={styles.emptyLogsText}>No logs yet</Text>
        <Text style={styles.emptyLogsSubtext}>
          Tap the + button on the home screen to log your first session
        </Text>
      </View>
    );
  }, [logsLoading]);

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        ListHeaderComponent={renderProfileHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <Modal
        visible={logoutConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLogoutConfirmVisible(false)}
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Are you sure you want to log out?</Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancelButton}
                onPress={() => setLogoutConfirmVisible(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmLogoutButton,
                  logoutMutation.isPending && styles.confirmLogoutButtonDisabled,
                ]}
                onPress={() => {
                  setLogoutConfirmVisible(false);
                  logoutMutation.mutate();
                }}
                disabled={logoutMutation.isPending}
              >
                <Text style={styles.confirmLogoutText}>
                  {logoutMutation.isPending ? 'Logging out...' : 'Log out'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  listContent: {
    paddingBottom: Spacing['6xl'],
  },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: Layout.avatarSizeXl,
    height: Layout.avatarSizeXl,
    borderRadius: Layout.avatarSizeXl / 2,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...Typography.h4,
    color: Colors.text,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  nameSection: {
    marginTop: Spacing.lg,
  },
  displayName: {
    ...Typography.h4,
    color: Colors.text,
  },
  username: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bio: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  editButton: {
    flex: 1,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    ...Typography.buttonSmall,
    color: Colors.text,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  confirmTitle: {
    ...Typography.h4,
    color: Colors.text,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  confirmCancelButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  confirmCancelText: {
    ...Typography.buttonSmall,
    color: Colors.text,
  },
  confirmLogoutButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  confirmLogoutButtonDisabled: {
    opacity: 0.7,
  },
  confirmLogoutText: {
    ...Typography.buttonSmall,
    color: Colors.textInverse,
  },
  widgetsSection: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  widgetSpacer: {
    height: 0,
  },
  sectionHeader: {
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.text,
  },
  logItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginRight: Spacing.sm,
  },
  logTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    flex: 1,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  privateBadgeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  logTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  logNote: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  taskIndicator: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  taskCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  socialStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginLeft: 'auto',
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniStatText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  emptyLogs: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing['3xl'],
  },
  emptyLogsText: {
    ...Typography.bodyMedium,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyLogsSubtext: {
    ...Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  loadingFooter: {
    paddingVertical: Spacing.xl,
  },
});
