import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Notification } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaginatedNotifications {
  data: Notification[];
  meta: {
    cursor: string | null;
    has_more: boolean;
  };
}

interface UnreadCountResponse {
  data: {
    count: number;
  };
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => ['notifications', 'list'] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
};

// ── Queries ──────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useInfiniteQuery<PaginatedNotifications>({
    queryKey: notificationKeys.list(),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get('/notifications', { params });
      return response.data as unknown as PaginatedNotifications;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const response = await api.get('/notifications/unread-count');
      return (response.data as { count: number }).count;
    },
    staleTime: 0, // Always refetch — notifications are time-sensitive
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.put(`/notifications/${notificationId}/read`);
      return notificationId;
    },
    onMutate: async (notificationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: notificationKeys.list(),
      });
      await queryClient.cancelQueries({
        queryKey: notificationKeys.unreadCount(),
      });

      // Snapshot previous values
      const previousList = queryClient.getQueryData(notificationKeys.list());
      const previousCount = queryClient.getQueryData(
        notificationKeys.unreadCount(),
      );

      // Optimistically update the notification list
      queryClient.setQueriesData(
        { queryKey: notificationKeys.list() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: PaginatedNotifications) => ({
              ...page,
              data: page.data.map((n: Notification) =>
                n.id === notificationId ? { ...n, is_read: true } : n,
              ),
            })),
          };
        },
      );

      // Optimistically decrement unread count
      queryClient.setQueryData(
        notificationKeys.unreadCount(),
        (old: number | undefined) => Math.max(0, (old ?? 1) - 1),
      );

      return { previousList, previousCount };
    },
    onError: (_err, _id, context) => {
      // Rollback
      if (context?.previousList) {
        queryClient.setQueryData(notificationKeys.list(), context.previousList);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(
          notificationKeys.unreadCount(),
          context.previousCount,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.put('/notifications/read-all');
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: notificationKeys.list(),
      });
      await queryClient.cancelQueries({
        queryKey: notificationKeys.unreadCount(),
      });

      const previousList = queryClient.getQueryData(notificationKeys.list());
      const previousCount = queryClient.getQueryData(
        notificationKeys.unreadCount(),
      );

      // Mark all as read optimistically
      queryClient.setQueriesData(
        { queryKey: notificationKeys.list() },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: PaginatedNotifications) => ({
              ...page,
              data: page.data.map((n: Notification) => ({
                ...n,
                is_read: true,
              })),
            })),
          };
        },
      );

      queryClient.setQueryData(notificationKeys.unreadCount(), 0);

      return { previousList, previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificationKeys.list(), context.previousList);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(
          notificationKeys.unreadCount(),
          context.previousCount,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
