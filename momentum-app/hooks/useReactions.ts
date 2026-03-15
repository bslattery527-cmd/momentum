import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaginatedUsers {
  data: User[];
  meta: {
    cursor: string | null;
    has_more: boolean;
  };
}

interface ToggleReactionParams {
  logId: string;
  hasReacted: boolean;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const reactionKeys = {
  users: (logId: string) => ['reactions', logId] as const,
};

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Toggle the celebrate reaction on a log.
 * Pass `hasReacted: true` to un-celebrate, `false` to celebrate.
 * Handles optimistic cache updates for both the feed and log detail.
 */
export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, hasReacted }: ToggleReactionParams) => {
      if (hasReacted) {
        // User currently has a reaction — remove it
        await api.delete(`/logs/${logId}/reactions`);
      } else {
        // User does not have a reaction — add one
        await api.post(`/logs/${logId}/reactions`);
      }
      return { logId, hasReacted };
    },
    onMutate: async ({ logId, hasReacted }) => {
      // Cancel any outgoing refetches for feed and log detail
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      await queryClient.cancelQueries({ queryKey: ['logs', logId] });

      // Snapshot previous values for rollback
      const previousFeedHome = queryClient.getQueryData(['feed', 'home']);
      const previousFeedExplore = queryClient.getQueryData([
        'feed',
        'explore',
      ]);
      const previousLogDetail = queryClient.getQueryData(['logs', logId]);

      // Helper to update a log entry in any cache
      const updateLog = (log: any) => {
        if (!log || log.id !== logId) return log;
        return {
          ...log,
          has_reacted: !hasReacted,
          reaction_count: hasReacted
            ? Math.max(0, (log.reaction_count ?? 1) - 1)
            : (log.reaction_count ?? 0) + 1,
        };
      };

      // Update feed caches (both home and explore)
      const updateFeedCache = (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map(updateLog),
          })),
        };
      };

      queryClient.setQueriesData({ queryKey: ['feed', 'home'] }, updateFeedCache);
      queryClient.setQueriesData(
        { queryKey: ['feed', 'explore'] },
        updateFeedCache,
      );

      // Update log detail cache
      queryClient.setQueryData(['logs', logId], updateLog);

      return { previousFeedHome, previousFeedExplore, previousLogDetail, logId };
    },
    onError: (_err, _vars, context) => {
      // Rollback all caches
      if (context?.previousFeedHome) {
        queryClient.setQueryData(['feed', 'home'], context.previousFeedHome);
      }
      if (context?.previousFeedExplore) {
        queryClient.setQueryData(
          ['feed', 'explore'],
          context.previousFeedExplore,
        );
      }
      if (context?.previousLogDetail) {
        queryClient.setQueryData(
          ['logs', context.logId],
          context.previousLogDetail,
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({
        queryKey: ['logs', variables.logId],
      });
    },
  });
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useReactionUsers(logId: string) {
  return useInfiniteQuery<PaginatedUsers>({
    queryKey: reactionKeys.users(logId),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get(`/logs/${logId}/reactions`, { params });
      return response.data as unknown as PaginatedUsers;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
    enabled: !!logId,
  });
}
