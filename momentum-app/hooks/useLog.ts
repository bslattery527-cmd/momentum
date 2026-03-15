import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Log, LogTask, Category } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateLogPayload {
  title: string;
  note?: string;
  is_published: boolean;
  started_at?: string;
  ended_at?: string;
  tasks: {
    task_name: string;
    category_id: string;
    duration: number; // seconds
    sort_order?: number;
  }[];
  tagged_user_ids?: string[];
  image_ids?: string[];
}

export interface UpdateLogPayload {
  title?: string;
  note?: string;
  is_published?: boolean;
  tasks?: {
    task_name: string;
    category_id: string;
    duration: number;
    sort_order?: number;
  }[];
  tagged_user_ids?: string[];
  image_ids?: string[];
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    cursor: string | null;
    has_more: boolean;
  };
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const logKeys = {
  all: ['logs'] as const,
  detail: (id: string) => ['logs', id] as const,
  userLogs: (username: string) => ['logs', username, 'public'] as const,
  myLogs: () => ['logs', 'me'] as const,
  categories: () => ['categories'] as const,
};

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLogPayload) => {
      const response = await api.post('/logs', payload);
      return response.data as Log;
    },
    onSuccess: () => {
      // Invalidate feed and personal log queries
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: logKeys.myLogs() });
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['goal'] });
    },
  });
}

export function useUpdateLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateLogPayload;
    }) => {
      const response = await api.put(`/logs/${id}`, payload);
      return response.data as Log;
    },
    onSuccess: (data, variables) => {
      // Update the log detail cache
      queryClient.setQueryData(logKeys.detail(variables.id), data);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: logKeys.myLogs() });
    },
  });
}

export function useDeleteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/logs/${id}`);
      return id;
    },
    onSuccess: (id) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: logKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: logKeys.myLogs() });
      queryClient.invalidateQueries({ queryKey: logKeys.all });
    },
  });
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useLogDetail(id: string) {
  return useQuery({
    queryKey: logKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/logs/${id}`);
      return response.data as Log;
    },
    enabled: !!id,
  });
}

export function useUserLogs(username: string) {
  return useInfiniteQuery<PaginatedResponse<Log>>({
    queryKey: logKeys.userLogs(username),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get(`/users/${username}/logs`, { params });
      return response.data as unknown as PaginatedResponse<Log>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
    enabled: !!username,
  });
}

export function useMyLogs() {
  return useInfiniteQuery<PaginatedResponse<Log>>({
    queryKey: logKeys.myLogs(),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get('/users/me/logs', { params });
      return response.data as unknown as PaginatedResponse<Log>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
  });
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: logKeys.categories(),
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data as Category[];
    },
    staleTime: Infinity, // Categories are static — cache forever
  });
}
