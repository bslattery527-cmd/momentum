import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Colors,
  Typography,
  Spacing,
  Shadows,
} from '@/constants/theme';
import { useExploreFeed } from '@/hooks/useFeed';
import { FeedCard } from '@/components/feed/FeedCard';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { FeedItem } from '@/types';

export default function ExploreScreen() {
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useExploreFeed();

  const feedItems: FeedItem[] =
    data?.pages.flatMap((page) => page.data) || [];

  // ─── Celebrate Mutation (same as home) ──────────────────────────────

  const celebrateMutation = useMutation({
    mutationFn: async ({
      logId,
      hasReacted,
    }: {
      logId: string;
      hasReacted: boolean;
    }) => {
      if (hasReacted) {
        await api.delete(`/logs/${logId}/reactions`);
      } else {
        await api.post(`/logs/${logId}/reactions`);
      }
    },
    onMutate: async ({ logId, hasReacted }) => {
      await queryClient.cancelQueries({ queryKey: ['feed', 'explore'] });
      const previousFeed = queryClient.getQueryData(['feed', 'explore']);

      queryClient.setQueryData(['feed', 'explore'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((item: FeedItem) =>
              item.id === logId
                ? {
                    ...item,
                    has_reacted: !hasReacted,
                    reaction_count:
                      item.reaction_count + (hasReacted ? -1 : 1),
                  }
                : item
            ),
          })),
        };
      });

      return { previousFeed };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed', 'explore'], context.previousFeed);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', 'explore'] });
    },
  });

  const handleCelebrate = useCallback(
    (logId: string, hasReacted: boolean) => {
      celebrateMutation.mutate({ logId, hasReacted });
    },
    [celebrateMutation]
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <FeedCard item={item} onCelebrate={handleCelebrate} />
    ),
    [handleCelebrate]
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
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="compass-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>Nothing to explore yet</Text>
        <Text style={styles.emptySubtitle}>
          Check back later for new sessions from the community
        </Text>
      </View>
    );
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Search Header Action ─────────────────────── */}
      <View style={styles.searchBar}>
        <Pressable
          style={styles.searchButton}
          onPress={() => {
            // UserSearchModal is built by Agent 3 — navigate or open modal
          }}
        >
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search people...</Text>
        </Pressable>
      </View>

      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  searchBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 20,
    gap: Spacing.sm,
  },
  searchPlaceholder: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  listContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing['6xl'],
  },
  loadingFooter: {
    paddingVertical: Spacing.xl,
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
});
