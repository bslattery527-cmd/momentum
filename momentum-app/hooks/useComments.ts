import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { Comment } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaginatedComments {
  data: Comment[];
  meta: {
    cursor: string | null;
    has_more: boolean;
  };
}

interface PostCommentParams {
  logId: string;
  body: string;
}

interface DeleteCommentParams {
  commentId: string;
  logId: string;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const commentKeys = {
  list: (logId: string) => ['comments', logId] as const,
};

// ── Queries ──────────────────────────────────────────────────────────────────

export function useComments(logId: string) {
  return useInfiniteQuery<PaginatedComments>({
    queryKey: commentKeys.list(logId),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get(`/logs/${logId}/comments`, { params });
      return response.data as PaginatedComments;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
    enabled: !!logId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function usePostComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, body }: PostCommentParams) => {
      const response = await api.post(`/logs/${logId}/comments`, { body });
      return response.data as Comment;
    },
    onMutate: async ({ logId, body }) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.list(logId),
      });

      const previousComments = queryClient.getQueryData(
        commentKeys.list(logId),
      );

      // Create an optimistic comment
      const user = useAuthStore.getState().user;
      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        log_id: logId,
        body,
        created_at: new Date().toISOString(),
        user: {
          id: user?.id ?? '',
          username: user?.username ?? '',
          display_name: user?.display_name ?? '',
          avatar_url: user?.avatar_url ?? null,
        },
      };

      // Add optimistic comment to the end of the last page
      queryClient.setQueryData(commentKeys.list(logId), (old: any) => {
        if (!old?.pages?.length) {
          return {
            pages: [
              {
                data: [optimisticComment],
                meta: { cursor: null, has_more: false },
              },
            ],
            pageParams: [undefined],
          };
        }

        const newPages = [...old.pages];
        const lastPageIndex = newPages.length - 1;
        newPages[lastPageIndex] = {
          ...newPages[lastPageIndex],
          data: [...newPages[lastPageIndex].data, optimisticComment],
        };

        return { ...old, pages: newPages };
      });

      // Also optimistically increment comment_count on feed cards
      const updateCommentCount = (log: any) => {
        if (!log || log.id !== logId) return log;
        return {
          ...log,
          comment_count: (log.comment_count ?? 0) + 1,
        };
      };

      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map(updateCommentCount),
          })),
        };
      });

      queryClient.setQueryData(['logs', logId], updateCommentCount);

      return { previousComments, logId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          commentKeys.list(context.logId),
          context.previousComments,
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(variables.logId),
      });
      queryClient.invalidateQueries({ queryKey: ['logs', variables.logId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId }: DeleteCommentParams) => {
      await api.delete(`/comments/${commentId}`);
      return commentId;
    },
    onMutate: async ({ commentId, logId }) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.list(logId),
      });

      const previousComments = queryClient.getQueryData(
        commentKeys.list(logId),
      );

      // Remove the comment optimistically
      queryClient.setQueryData(commentKeys.list(logId), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: PaginatedComments) => ({
            ...page,
            data: page.data.filter((c) => c.id !== commentId),
          })),
        };
      });

      // Decrement comment count on feed/log
      const updateCommentCount = (log: any) => {
        if (!log || log.id !== logId) return log;
        return {
          ...log,
          comment_count: Math.max(0, (log.comment_count ?? 1) - 1),
        };
      };

      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map(updateCommentCount),
          })),
        };
      });

      queryClient.setQueryData(['logs', logId], updateCommentCount);

      return { previousComments, logId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          commentKeys.list(context.logId),
          context.previousComments,
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(variables.logId),
      });
      queryClient.invalidateQueries({ queryKey: ['logs', variables.logId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
