/**
 * Demo API interceptor — returns fixture data when the app is in demo mode.
 *
 * This module intercepts Axios requests before they reach the network,
 * pattern-matching URL + method to return appropriate mock data.
 *
 * Response format note:
 * The existing Axios response interceptor in api.ts unwraps `{ data: X }` envelopes
 * for non-paginated responses and leaves paginated `{ data: [...], meta: {...} }`
 * responses untouched.
 *
 * Because the demo adapter returns data *before* the response interceptor runs,
 * we must wrap our responses in the same envelope the real API returns so the
 * existing unwrapping logic works correctly.
 *
 * - Non-paginated: wrap as `{ data: actualPayload }`
 * - Paginated: wrap as `{ data: items[], meta: { cursor, has_more } }`
 * - Status-only (201/204): return `{}`
 */

import { useAuthStore } from '@/store/authStore';
import {
  DEMO_USER_ID,
  demoUser,
  demoUserProfile,
  demoUsers,
  demoCategories,
  demoFeedItems,
  demoExploreFeedItems,
  demoUserLogs,
  demoComments,
  demoNotifications,
  demoStreak,
  demoGoal,
  demoFollowers,
  demoFollowing,
} from './demoData';
import type { FeedItem, Log, Comment, Notification } from '@/types';

// ─── In-memory mutable state for demo session ──────────────────────────────

let mutableNotifications = [...demoNotifications];
let mutableFeedItems = [...demoFeedItems];
let mutableExploreFeedItems = [...demoExploreFeedItems];
let mutableUserLogs = [...demoUserLogs];
let mutableComments: Record<string, Comment[]> = JSON.parse(
  JSON.stringify(demoComments),
);
let nextLogCounter = 100;
let nextCommentCounter = 100;

/**
 * Check whether the app is currently in demo mode.
 */
export function isDemoMode(): boolean {
  const { user } = useAuthStore.getState();
  return user?.id === DEMO_USER_ID;
}

// ─── URL pattern matching helpers ──────────────────────────────────────────

function matchRoute(
  method: string,
  url: string,
): { route: string; params: Record<string, string> } | null {
  // Normalise: strip leading slash, strip query string for matching
  const [path] = url.split('?');
  const cleanPath = path.replace(/^\//, '');

  const patterns: Array<{ method: string; pattern: RegExp; route: string }> = [
    // Feed
    { method: 'GET', pattern: /^feed\/explore$/, route: 'GET /feed/explore' },
    { method: 'GET', pattern: /^feed$/, route: 'GET /feed' },

    // Users - me
    { method: 'GET', pattern: /^users\/me\/logs$/, route: 'GET /users/me/logs' },
    { method: 'GET', pattern: /^users\/me\/goals\/current$/, route: 'GET /users/me/goals/current' },
    { method: 'GET', pattern: /^users\/me\/streak$/, route: 'GET /users/me/streak' },
    { method: 'GET', pattern: /^users\/me$/, route: 'GET /users/me' },

    // Users - search
    { method: 'GET', pattern: /^users\/search$/, route: 'GET /users/search' },

    // Users - by username
    { method: 'GET', pattern: /^users\/([^/]+)\/followers$/, route: 'GET /users/:username/followers' },
    { method: 'GET', pattern: /^users\/([^/]+)\/following$/, route: 'GET /users/:username/following' },
    { method: 'GET', pattern: /^users\/([^/]+)\/logs$/, route: 'GET /users/:username/logs' },
    { method: 'POST', pattern: /^users\/([^/]+)\/follow$/, route: 'POST /users/:username/follow' },
    { method: 'DELETE', pattern: /^users\/([^/]+)\/follow$/, route: 'DELETE /users/:username/follow' },
    { method: 'GET', pattern: /^users\/([^/]+)$/, route: 'GET /users/:username' },

    // Logs
    { method: 'POST', pattern: /^logs\/([^/]+)\/reactions$/, route: 'POST /logs/:id/reactions' },
    { method: 'DELETE', pattern: /^logs\/([^/]+)\/reactions$/, route: 'DELETE /logs/:id/reactions' },
    { method: 'GET', pattern: /^logs\/([^/]+)\/reactions$/, route: 'GET /logs/:id/reactions' },
    { method: 'POST', pattern: /^logs\/([^/]+)\/comments$/, route: 'POST /logs/:id/comments' },
    { method: 'GET', pattern: /^logs\/([^/]+)\/comments$/, route: 'GET /logs/:id/comments' },
    { method: 'GET', pattern: /^logs\/([^/]+)$/, route: 'GET /logs/:id' },
    { method: 'POST', pattern: /^logs$/, route: 'POST /logs' },

    // Comments
    { method: 'DELETE', pattern: /^comments\/([^/]+)$/, route: 'DELETE /comments/:id' },

    // Notifications
    { method: 'GET', pattern: /^notifications\/unread-count$/, route: 'GET /notifications/unread-count' },
    { method: 'PUT', pattern: /^notifications\/read-all$/, route: 'PUT /notifications/read-all' },
    { method: 'PUT', pattern: /^notifications\/([^/]+)\/read$/, route: 'PUT /notifications/:id/read' },
    { method: 'GET', pattern: /^notifications$/, route: 'GET /notifications' },

    // Categories
    { method: 'GET', pattern: /^categories$/, route: 'GET /categories' },

    // Goals
    { method: 'POST', pattern: /^users\/me\/goals$/, route: 'POST /users/me/goals' },

    // Auth (for refresh token during hydrate)
    { method: 'POST', pattern: /^auth\/refresh$/, route: 'POST /auth/refresh' },
    { method: 'POST', pattern: /^auth\/logout$/, route: 'POST /auth/logout' },
  ];

  for (const p of patterns) {
    if (p.method !== method.toUpperCase()) continue;
    const match = cleanPath.match(p.pattern);
    if (match) {
      const params: Record<string, string> = {};
      if (match[1]) {
        // Extract the first capture group as the primary param
        if (p.route.includes(':username')) params.username = match[1];
        else if (p.route.includes(':id')) params.id = match[1];
      }
      return { route: p.route, params };
    }
  }

  return null;
}

// ─── Query string parser ──────────────────────────────────────────────────

function parseQuery(url: string): Record<string, string> {
  const qs: Record<string, string> = {};
  const idx = url.indexOf('?');
  if (idx < 0) return qs;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    const [k, v] = pair.split('=');
    if (k) qs[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return qs;
}

// ─── Pagination helper ────────────────────────────────────────────────────

function paginate<T extends { id?: string }>(
  items: T[],
  cursor: string | null | undefined,
  limit: number = 20,
): { data: T[]; meta: { cursor: string | null; has_more: boolean } } {
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = items.findIndex(
      (item: any) => item.id === cursor,
    );
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }
  const page = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]?.id ?? null : null;
  return {
    data: page,
    meta: { cursor: nextCursor as string | null, has_more: hasMore },
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────

/**
 * Handle a demo-mode request. Returns an object shaped exactly like `response.data`
 * from the real API (before the response interceptor processes it).
 *
 * Returns `null` if the route is not recognized (should not happen in practice).
 */
export function handleDemoRequest(
  method: string,
  url: string,
  data?: any,
): { responseData: any; status: number } | null {
  const matched = matchRoute(method, url);
  if (!matched) return null;

  const { route, params } = matched;
  const query = parseQuery(url);
  const cursor = query.cursor || undefined;
  const limit = parseInt(query.limit || '20', 10);

  switch (route) {
    // ── Feed ──────────────────────────────────────────────────────────
    case 'GET /feed': {
      const result = paginate(mutableFeedItems, cursor, limit);
      // Paginated: return { data: [...], meta: {...} } — interceptor won't unwrap
      return { responseData: result, status: 200 };
    }

    case 'GET /feed/explore': {
      const result = paginate(mutableExploreFeedItems, cursor, limit);
      return { responseData: result, status: 200 };
    }

    // ── Users/Me ─────────────────────────────────────────────────────
    case 'GET /users/me': {
      // Return the demo user with extra profile fields
      const me = {
        ...demoUser,
        follower_count: demoUserProfile.follower_count,
        following_count: demoUserProfile.following_count,
        log_count: demoUserProfile.log_count,
      };
      return { responseData: { data: me }, status: 200 };
    }

    case 'GET /users/me/logs': {
      const result = paginate(mutableUserLogs, cursor, limit);
      return { responseData: result, status: 200 };
    }

    case 'GET /users/me/goals/current': {
      return { responseData: { data: demoGoal }, status: 200 };
    }

    case 'GET /users/me/streak': {
      return { responseData: { data: demoStreak }, status: 200 };
    }

    case 'POST /users/me/goals': {
      const newGoal = {
        ...demoGoal,
        id: `goal-demo-${Date.now()}`,
        type: data?.type || 'days',
        target: data?.target || 5,
        days_logged: 0,
        minutes_logged: 0,
        is_completed: false,
        created_at: new Date().toISOString(),
      };
      return { responseData: { data: newGoal }, status: 201 };
    }

    // ── Users/Search ─────────────────────────────────────────────────
    case 'GET /users/search': {
      const q = (query.q || '').toLowerCase();
      const allUsers = [demoUser, ...demoUsers.map(u => ({
        id: u.id,
        email: `${u.username}@example.com`,
        display_name: u.display_name,
        username: u.username,
        avatar_url: u.avatar_url,
        bio: u.bio,
        created_at: new Date().toISOString(),
      }))];
      const filtered = q
        ? allUsers.filter(
            (u) =>
              u.display_name.toLowerCase().includes(q) ||
              u.username.toLowerCase().includes(q),
          )
        : allUsers;
      return { responseData: { data: filtered }, status: 200 };
    }

    // ── Users/:username ──────────────────────────────────────────────
    case 'GET /users/:username': {
      const username = params.username;
      if (username === demoUser.username) {
        return { responseData: { data: demoUserProfile }, status: 200 };
      }
      const found = demoUsers.find((u) => u.username === username);
      if (found) {
        return { responseData: { data: found }, status: 200 };
      }
      return { responseData: { error: { code: 'NOT_FOUND', message: 'User not found' } }, status: 404 };
    }

    case 'GET /users/:username/logs': {
      const username = params.username;
      // Find the user
      const targetUser = demoUsers.find((u) => u.username === username);
      if (!targetUser) {
        return { responseData: { data: [], meta: { cursor: null, has_more: false } }, status: 200 };
      }
      // Get all feed items from this user (they are public logs)
      const userLogs: Log[] = [...mutableFeedItems, ...mutableExploreFeedItems]
        .filter((fi) => fi.user_id === targetUser.id)
        .map(({ user, has_reacted, streak_at_time, ...log }) => log);
      const result = paginate(userLogs, cursor, limit);
      return { responseData: result, status: 200 };
    }

    case 'GET /users/:username/followers': {
      const result = paginate(demoFollowers, cursor, limit);
      return { responseData: result, status: 200 };
    }

    case 'GET /users/:username/following': {
      const result = paginate(demoFollowing, cursor, limit);
      return { responseData: result, status: 200 };
    }

    case 'POST /users/:username/follow': {
      const user = demoUsers.find((u) => u.username === params.username);
      if (user) {
        user.is_following = true;
        user.follower_count += 1;
      }
      return { responseData: {}, status: 201 };
    }

    case 'DELETE /users/:username/follow': {
      const user = demoUsers.find((u) => u.username === params.username);
      if (user) {
        user.is_following = false;
        user.follower_count = Math.max(0, user.follower_count - 1);
      }
      return { responseData: {}, status: 204 };
    }

    // ── Logs ─────────────────────────────────────────────────────────
    case 'GET /logs/:id': {
      const logId = params.id;
      // Search across all log collections
      const allLogs = [...mutableFeedItems, ...mutableExploreFeedItems, ...mutableUserLogs];
      const found = allLogs.find((l) => l.id === logId);
      if (found) {
        // Strip feed-specific fields if present
        const { user: _u, has_reacted: _hr, streak_at_time: _s, ...logData } = found as any;
        return { responseData: { data: logData }, status: 200 };
      }
      return { responseData: { error: { code: 'NOT_FOUND', message: 'Log not found' } }, status: 404 };
    }

    case 'POST /logs': {
      const now = new Date().toISOString();
      const newLogId = `log-demo-${nextLogCounter++}`;
      const newLog: Log = {
        id: newLogId,
        user_id: DEMO_USER_ID,
        title: data?.title || 'Untitled Session',
        note: data?.note || null,
        total_duration: (data?.tasks || []).reduce(
          (sum: number, t: any) => sum + (t.duration || 0),
          0,
        ),
        started_at: data?.started_at || now,
        ended_at: data?.ended_at || now,
        is_published: data?.is_published ?? true,
        published_at: data?.is_published ? now : null,
        tasks: (data?.tasks || []).map((t: any, i: number) => ({
          id: `task-demo-${nextLogCounter}-${i}`,
          category_id: t.category_id,
          task_name: t.task_name,
          duration: t.duration,
          sort_order: t.sort_order ?? i,
          category: demoCategories.find((c) => c.id === t.category_id) || demoCategories[5],
        })),
        images: [],
        tagged_users: [],
        reaction_count: 0,
        comment_count: 0,
        created_at: now,
      };

      // Add to user's own logs
      mutableUserLogs.unshift(newLog);

      // If published, also add to home feed as a FeedItem
      if (newLog.is_published) {
        const feedItem: FeedItem = {
          ...newLog,
          user: {
            id: demoUser.id,
            username: demoUser.username,
            display_name: demoUser.display_name,
            avatar_url: demoUser.avatar_url,
          },
          has_reacted: false,
          streak_at_time: demoStreak.current_streak,
        };
        mutableFeedItems.unshift(feedItem);
      }

      return { responseData: { data: newLog }, status: 201 };
    }

    // ── Reactions ────────────────────────────────────────────────────
    case 'POST /logs/:id/reactions': {
      const logId = params.id;
      // Toggle reaction on in feed data
      updateReactionInFeeds(logId, true);
      return { responseData: {}, status: 201 };
    }

    case 'DELETE /logs/:id/reactions': {
      const logId = params.id;
      updateReactionInFeeds(logId, false);
      return { responseData: {}, status: 204 };
    }

    case 'GET /logs/:id/reactions': {
      // Return some users who reacted
      const reactors = demoUsers.slice(0, 3).map((u) => ({
        id: u.id,
        email: `${u.username}@example.com`,
        display_name: u.display_name,
        username: u.username,
        avatar_url: u.avatar_url,
        bio: u.bio,
        created_at: new Date().toISOString(),
      }));
      const result = paginate(reactors, cursor, limit);
      return { responseData: result, status: 200 };
    }

    // ── Comments ─────────────────────────────────────────────────────
    case 'GET /logs/:id/comments': {
      const logId = params.id;
      const comments = mutableComments[logId] || [];
      const result = paginate(comments, cursor, limit);
      return { responseData: result, status: 200 };
    }

    case 'POST /logs/:id/comments': {
      const logId = params.id;
      const now = new Date().toISOString();
      const newComment: Comment = {
        id: `cmt-demo-${nextCommentCounter++}`,
        log_id: logId,
        body: data?.body || '',
        user: {
          id: demoUser.id,
          username: demoUser.username,
          display_name: demoUser.display_name,
          avatar_url: demoUser.avatar_url,
        },
        created_at: now,
      };

      if (!mutableComments[logId]) {
        mutableComments[logId] = [];
      }
      mutableComments[logId].push(newComment);

      return { responseData: { data: newComment }, status: 201 };
    }

    case 'DELETE /comments/:id': {
      const commentId = params.id;
      // Remove from all comment lists
      for (const logId of Object.keys(mutableComments)) {
        mutableComments[logId] = mutableComments[logId].filter(
          (c) => c.id !== commentId,
        );
      }
      return { responseData: {}, status: 204 };
    }

    // ── Notifications ────────────────────────────────────────────────
    case 'GET /notifications': {
      const result = paginate(mutableNotifications, cursor, limit);
      return { responseData: result, status: 200 };
    }

    case 'GET /notifications/unread-count': {
      const count = mutableNotifications.filter((n) => !n.is_read).length;
      return { responseData: { data: { unread_count: count } }, status: 200 };
    }

    case 'PUT /notifications/:id/read': {
      const notifId = params.id;
      mutableNotifications = mutableNotifications.map((n) =>
        n.id === notifId ? { ...n, is_read: true } : n,
      );
      return { responseData: {}, status: 200 };
    }

    case 'PUT /notifications/read-all': {
      mutableNotifications = mutableNotifications.map((n) => ({
        ...n,
        is_read: true,
      }));
      return { responseData: {}, status: 200 };
    }

    // ── Categories ───────────────────────────────────────────────────
    case 'GET /categories': {
      return { responseData: { data: demoCategories }, status: 200 };
    }

    // ── Auth ─────────────────────────────────────────────────────────
    case 'POST /auth/refresh': {
      // In demo mode, return the demo user tokens
      return {
        responseData: {
          data: {
            access_token: 'demo-access-token',
            refresh_token: 'demo-refresh-token',
            user: demoUser,
          },
        },
        status: 200,
      };
    }

    case 'POST /auth/logout': {
      return { responseData: {}, status: 200 };
    }

    default:
      return null;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function updateReactionInFeeds(logId: string, reacted: boolean): void {
  const update = (item: FeedItem) => {
    if (item.id !== logId) return item;
    return {
      ...item,
      has_reacted: reacted,
      reaction_count: reacted
        ? item.reaction_count + 1
        : Math.max(0, item.reaction_count - 1),
    };
  };
  mutableFeedItems = mutableFeedItems.map(update);
  mutableExploreFeedItems = mutableExploreFeedItems.map(update);
}
