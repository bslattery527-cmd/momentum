import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Feed data is stale after 60 seconds
      staleTime: 60 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Refetch on window focus (when app comes to foreground)
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default — let pull-to-refresh handle it
      refetchOnReconnect: false,
    },
    mutations: {
      // Don't retry mutations by default
      retry: false,
    },
  },
});
