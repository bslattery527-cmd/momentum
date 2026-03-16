# Cross-Review Notes

## Task #26: Frontend Features (Agent 3) Reviews Backend (Agent 1)

**Reviewer:** Agent 3 (Frontend Features)
**Date:** 2026-03-15
**Scope:** All files in `momentum-api/`

---

### Summary

The backend implementation is solid and closely follows the EDD specification. The code is well-organized, follows Fastify conventions, and implements all required endpoints with proper validation, authentication, and error handling.

**Files Reviewed:**
- `prisma/schema.prisma`, `prisma/seed.ts`
- `src/app.ts`, `src/server.ts`
- `src/plugins/*.ts` (auth, cors, helmet, rateLimit, prisma)
- `src/routes/*.ts` (auth, users, logs, feed, follows, reactions, comments, goals, notifications, categories)
- `src/schemas/*.ts` (auth.schema, user.schema, log.schema)
- `src/services/*.ts` (streakService, goalService, pushService, imageService)
- `src/jobs/cleanupOrphanImages.ts`
- `src/lib/*.ts` (prisma, jwt)

---

### Issues Found and Fixed

#### 1. FIXED: `GET /users/me/logs` missing `user_id` and `has_reacted` fields
**File:** `momentum-api/src/routes/users.ts`
**Severity:** Medium
**Description:** The `/users/me/logs` endpoint response was missing the `user_id` field (present in other log endpoints like `POST /logs` and `GET /logs/:id`) and the `has_reacted` field (present in feed and `/:username/logs` endpoints). This inconsistency would cause frontend components that expect these fields to break or show missing data.
**Fix:** Added `user_id: log.userId` and `has_reacted: reactedLogIds.has(log.id)` to the response, along with the query to check the authenticated user's reactions.

#### 2. FIXED: Dead database query in `goalService.ts`
**File:** `momentum-api/src/services/goalService.ts`
**Severity:** Low (performance)
**Description:** The `updateGoalProgress` function contained an unused `findFirst` query (`existingLogToday`) that fetched data from the database but was never referenced. The actual logic used a separate `count` query instead. This wasted a database round-trip on every log creation.
**Fix:** Removed the unused `findFirst` query.

---

### Issues Noted (Not Fixed -- Informational)

#### 3. NOTE: `PUT /users/me` allows username changes (not in EDD spec)
**File:** `momentum-api/src/routes/users.ts`
**Severity:** Low
**Description:** EDD Section 5.3 lists the updatable fields for `PUT /users/me` as: display name, bio, avatar, goal_category. The implementation also allows updating `username`. This is extra functionality not specified in the EDD. Not harmful, but worth noting for spec compliance.

#### 4. NOTE: Missing partial unique index on `goals` table
**File:** `prisma/schema.prisma`
**Severity:** Low
**Description:** EDD Section 4 specifies `CREATE UNIQUE INDEX idx_goals_user_active ON goals(user_id) WHERE is_completed = FALSE;` (a partial unique index to ensure at most one active goal per user). Prisma does not natively support partial unique indexes in schema.prisma. The application layer in `goalService.ts` handles this by marking old goals as completed before creating new ones, but a raw SQL migration would be needed for the database-level constraint.

#### 5. NOTE: `log_image_uploads` table replaced with nullable `logId` on `LogImage`
**File:** `prisma/schema.prisma`
**Severity:** None (design decision)
**Description:** The EDD mentions a `log_image_uploads` table for temporary pending uploads. The implementation uses a simpler approach: `LogImage.logId` is nullable, where `null` indicates a pending upload. This is already documented in PROGRESS.md as a deliberate design decision and is functionally equivalent.

#### 6. NOTE: No user ownership verification for pending image IDs
**File:** `momentum-api/src/routes/logs.ts`, `momentum-api/src/services/imageService.ts`
**Severity:** Low (MVP acceptable)
**Description:** When `POST /logs` receives `image_ids[]`, it verifies that the images exist and are pending (`logId = null`), but does not verify that the images were created by the same user. Since image IDs are UUIDs (128-bit random), the probability of guessing another user's pending image ID is effectively zero. Acceptable for MVP, but for production hardening, consider adding a `createdBy` field to `LogImage`.

#### 7. NOTE: `streak_at_time` in feed uses current streak, not historical
**File:** `momentum-api/src/routes/feed.ts`
**Severity:** Low
**Description:** The feed card includes `streak_at_time` which is supposed to show the author's streak at the time the log was posted. The implementation fetches the author's **current** streak instead. Storing historical streak data would require denormalization (adding a `streak_at_time` column to the `logs` table). Acceptable simplification for MVP.

---

### Verification Checklist

| Check | Status | Notes |
|-------|--------|-------|
| All 6 auth endpoints implemented | PASS | register, login, google, apple, refresh, logout |
| All 7 user endpoints implemented | PASS | me (GET/PUT), :username, search, avatar-upload, push-token (POST/DELETE) |
| All 7 log endpoints implemented | PASS | create, get/:id, update, delete, user logs, me/logs, image-upload |
| Feed endpoints (home, explore) | PASS | Both with cursor pagination, has_reacted, streak_at_time |
| Follow endpoints | PASS | follow (201/409/422), unfollow (204), followers, following |
| Reaction endpoints | PASS | create (201/409), delete (204), list |
| Comment endpoints | PASS | list (oldest-first), create, delete (author OR log owner) |
| Goal endpoints | PASS | create/replace, current, streak |
| Notification endpoints | PASS | list, unread-count, read, read-all |
| Categories endpoint | PASS | list (no auth required) |
| Response envelope `{ data, meta }` | PASS | All endpoints use correct envelope |
| Error envelope `{ error: { code, message, details } }` | PASS | Consistent error format |
| Cursor-based pagination on all lists | PASS | All list endpoints use limit+1 pattern |
| Database schema matches EDD | PASS | All 14 models present with correct columns (minus partial unique index) |
| Cascade delete rules | PASS | ON DELETE CASCADE on all foreign keys |
| Streak logic matches EDD 10.2 | PASS | Exact match to pseudocode |
| Rate limits per EDD 10.5 | PASS | All per-route limits correct |
| bcrypt cost 12 | PASS | `BCRYPT_ROUNDS = 12` in auth.ts |
| Separate JWT secrets | PASS | `JWT_SECRET` for access, `JWT_REFRESH_SECRET` for refresh |
| Username regex `/^[a-z0-9_]{3,30}$/` | PASS | Validated in auth.ts and users.ts |
| Email not in public profile | PASS | GET /:username does not include email |
| Comment delete auth (author OR log owner) | PASS | Both checks present in comments.ts |
| Log read auth (published=anyone, private=owner) | PASS | Checked in logs.ts GET /:id |
| Two-phase image upload | PASS | Reserve (image-upload) -> Upload (S3) -> Commit (POST /logs) |
| Orphan image cleanup cron | PASS | Nightly at 3:00 AM UTC, 10-min cutoff |
| Self-notification prevention | PASS | `actorId === recipientId` check in pushService.ts |
| JWT access token 15min / refresh 30d | PASS | Defined in lib/jwt.ts |

---

## Task #24: Backend (Agent 1) Reviews Frontend Core (Agent 2)

**Reviewer:** Agent 1 (Backend)
**Date:** 2026-03-15
**Scope:** All files in `momentum-app/` created by Agent 2

---

### Summary

The frontend code is well-structured and mostly correct. However, there were several API contract mismatches that would have caused runtime failures. The most critical were: the response interceptor breaking all paginated endpoints, the `hydrate()` function assuming the refresh endpoint returns user data (it does not), the avatar-upload call missing required body fields, and the notification unread-count property name mismatch.

---

### Issues Found and Fixed

#### CRITICAL - Would cause runtime failure

**1. FIXED: Response interceptor breaks paginated endpoints** (`lib/api.ts`)
- The response interceptor was unwrapping ALL responses that had a `data` property, including paginated responses (`{ data: [...], meta: {...} }`). This stripped the `meta` object, making `getNextPageParam` always return `undefined`, completely breaking infinite scroll on every feed, notifications, and user logs.
- **Fix:** Added a check to skip unwrapping when `meta` is present in the response.

**2. FIXED: `hydrate()` assumes refresh returns user data** (`store/authStore.ts`)
- The `hydrate()` function called `POST /auth/refresh` and destructured `{ access_token, refresh_token, user }` from the response. The backend refresh endpoint only returns `{ access_token, refresh_token }` -- no `user`. This meant `user` was always `undefined` after a cold start, breaking the entire auth state on app relaunch.
- **Fix:** After refreshing tokens, added a separate `GET /users/me` call to fetch the user profile.

**3. FIXED: Avatar upload missing required body fields** (`app/(onboarding)/index.tsx`)
- The `uploadAvatar()` function called `POST /users/me/avatar-upload` with no request body. The backend requires `{ mime_type, file_size }` -- the request would always fail with a 400 validation error, preventing avatar uploads during onboarding.
- **Fix:** Added `mime_type` and `file_size` to the request body by fetching the blob first to determine its size.

**4. FIXED: Notification unread-count property name mismatch** (`app/(tabs)/_layout.tsx`)
- The tab layout read `(response.data as { count: number }).count` but the backend returns `{ unread_count: ... }`. The notification badge would never display.
- **Fix:** Changed to read `.unread_count` instead of `.count`.

#### MODERATE - Type mismatches

**5. FIXED: `User` type included non-existent fields** (`types/index.ts`)
- `is_active` and `updated_at` were on the `User` interface but the backend never returns these in auth/user responses.
- **Fix:** Removed `is_active` and `updated_at`. Made `goal_category` optional (only in GET /users/me, not auth responses).

**6. FIXED: `Log` type included `updated_at`** (`types/index.ts`)
- Backend log responses never include `updated_at`.
- **Fix:** Removed `updated_at`.

**7. FIXED: `Comment` type had `user_id` and `updated_at`** (`types/index.ts`)
- Backend returns `{ id, log_id, user, body, created_at }` -- no `user_id` or `updated_at`.
- **Fix:** Removed both fields.

**8. FIXED: `LogTask` type had `log_id`** (`types/index.ts`)
- Backend task responses don't include `log_id`.
- **Fix:** Removed `log_id`.

**9. FIXED: `Streak` type had `user_id`** (`types/index.ts`)
- Backend streak response doesn't include `user_id`.
- **Fix:** Removed `user_id`.

**10. FIXED: `Goal` type had `user_id` and `updated_at`** (`types/index.ts`)
- Backend goal responses don't include these.
- **Fix:** Removed both.

**11. FIXED: `FeedItem.streak_at_time` typed as `number | null`** (`types/index.ts`)
- Backend always returns a number (defaults to 0 via `?? 0`), never `null`.
- **Fix:** Changed to `number`.

**12. FIXED: `UpdateUserPayload` missing `username` and nullable types** (`types/index.ts`)
- Backend `PUT /users/me` accepts `username`, and `bio`/`avatar_url`/`goal_category` can be `null`.
- **Fix:** Added `username` field and `| null` to nullable fields.

**13. FIXED: `Notification` type had `recipient_id` and `actor_id`** (`types/index.ts`)
- Backend notification response returns `{ id, type, actor: {...}, entity_type, entity_id, is_read, created_at }` -- no `recipient_id` or `actor_id` at the top level.
- **Fix:** Removed both fields. Changed `entity_type` to `string | null` to match backend.

#### MINOR - Logic fixes

**14. FIXED: Log detail `has_reacted` never read from API** (`app/logs/[id].tsx`)
- Backend `GET /logs/:id` returns `has_reacted`, but the detail screen initialized `hasReacted` to `false` and never synced the API value.
- **Fix:** Added reading `has_reacted` from the log response in the useEffect.

**15. FIXED: Cleaned up page data extraction** (multiple files)
- Changed `page.data || page` fallback patterns to `page.data` now that the interceptor correctly preserves paginated response structure.

**16. FIXED: `CommentThread.tsx` used `comment.user_id` instead of `comment.user.id`** (`components/common/CommentThread.tsx`)
- The `canDelete` function checked `comment.user_id` to determine if the current user authored the comment. The backend doesn't return `user_id` on comments -- instead, the author info is in the nested `comment.user` object.
- **Fix:** Changed to `comment.user.id`.

**17. FIXED: Optimistic comment in `useComments.ts` used removed fields** (`hooks/useComments.ts`)
- The optimistic comment included `user_id` and `updated_at` which are not in the `Comment` type or backend response.
- **Fix:** Removed both fields from the optimistic comment object.

---

### What Was Correct

- **Auth flow architecture**: Access token in memory (Zustand), refresh token in SecureStore -- correctly per EDD.
- **401 handling**: Silent refresh + queue mechanism handles concurrent requests correctly.
- **OAuth flows**: Google (`id_token`) and Apple (`identity_token`, `display_name`) field names match backend schemas.
- **API URL paths**: All endpoint paths match backend route registration.
- **HTTP methods**: GET/POST/PUT/DELETE usage matches backend.
- **Request body shapes**: Register, login, OAuth, goal creation payloads all match backend schemas.
- **Query/cache patterns**: Proper staleTime, cache invalidation on mutations, optimistic updates with rollback.
- **Navigation structure**: Auth gate correctly routes between (auth), (onboarding), and (tabs).
- **Cursor-based pagination**: Correct `useInfiniteQuery` with `getNextPageParam` reading cursor from meta.
- **Components**: FeedCard, ImageGrid, StreakWidget, GoalWidget match API data shapes.

---

## Task #25: Frontend Core (Agent 2) Reviews Frontend Features (Agent 3)

**Reviewer:** Agent 2 (Frontend Core)
**Date:** 2026-03-15
**Scope:** All files in `momentum-app/` created by Agent 3

---

### Summary

Agent 3's code is well-structured with good patterns (optimistic updates with rollback, proper cache invalidation, accessibility labels, error handling). However, there were several integration issues that would have caused runtime failures due to naming mismatches with the core codebase. All have been fixed.

**Files Reviewed:**
- `components/log/LogSheet.tsx`, `StopwatchBanner.tsx`, `ImagePicker.tsx`, `TaskInput.tsx`, `DurationPicker.tsx`
- `components/common/ReactionButton.tsx`, `FollowButton.tsx`, `CommentThread.tsx`, `UserSearchModal.tsx`
- `components/notifications/NotificationItem.tsx`
- `hooks/useLog.ts`, `useNotifications.ts`, `useFollow.ts`, `useReactions.ts`, `useComments.ts`, `useGoals.ts`, `useSearch.ts`
- `lib/imageUpload.ts`, `lib/stopwatch.ts`

---

### Issues Found and Fixed

#### CRITICAL - Would cause runtime failure

**1. FIXED: Theme import naming mismatch** (All 11 component files)
- Agent 3 imports `{ colors, spacing, typography }` (camelCase) from `@/constants/theme`, but the theme file exports `Colors`, `Spacing`, `Typography` (PascalCase). Every Agent 3 component would crash on render with `undefined is not an object` errors.
- **Fix:** Added camelCase re-exports to `constants/theme.ts` as aliases.

**2. FIXED: Missing `typography.subtitle` key** (LogSheet.tsx, StopwatchBanner.tsx, TaskInput.tsx, UserSearchModal.tsx)
- Agent 3 references `typography.subtitle` which does not exist in the Typography constant. Spreading `undefined` into a StyleSheet would produce invalid styles.
- **Fix:** Added `subtitle: Typography.h4` to the camelCase alias in theme.ts.

**3. FIXED: Query key mismatch - log detail** (hooks/useLog.ts, hooks/useReactions.ts, hooks/useComments.ts)
- Agent 3 uses `['log', id]` (singular) for log detail cache keys, but core `useFeed.ts` uses `['logs', logId]` (plural). Optimistic updates from reactions/comments would write to a different cache than what the log detail screen reads.
- **Fix:** Changed all `['log', ...]` to `['logs', ...]` across 3 files (9 occurrences).

**4. FIXED: Query key mismatch - user profile** (hooks/useFollow.ts)
- Agent 3's useFollow/useUnfollow use `['user', username]` for cache keys, but core `users/[username].tsx` uses `['profile', username]`. Optimistic follow/unfollow updates would not reflect on the profile screen.
- **Fix:** Changed all `['user', ...]` to `['profile', ...]` (8 occurrences).

**5. FIXED: API response double-unwrapping** (8 hook/lib files)
- Agent 3's hooks use `response.data.data` to unwrap API responses, but the API interceptor already unwraps the `{ data: ... }` envelope. After the interceptor, `response.data` IS the payload; `.data` on it returns `undefined`, causing silent data loss.
- **Fix:** Changed all `response.data.data` to `response.data as Type` and removed type generics, matching the core pattern.

#### MODERATE

**6. FIXED: Type safety in usePostComment** (hooks/useComments.ts)
- Optimistic comment's `user` field was conditionally `undefined`, but the `Comment` type requires it as non-optional.
- **Fix:** Always provide the `user` object with fallback empty strings.

**7. FIXED: Unnecessary type casts** (NotificationItem.tsx, CommentThread.tsx)
- `(notification as any).actor` and `(item as any).user` were unnecessary since these fields are already typed.
- **Fix:** Removed `as any` casts.

**8. FIXED: Hardcoded colors in NotificationItem** (NotificationItem.tsx)
- Used hardcoded hex colors instead of theme constants, and wrong icon name ('at' vs 'pricetag' for tag type).
- **Fix:** Replaced with theme references and aligned icon name with core.

#### MINOR

**9. FIXED: Notification unread background color** (NotificationItem.tsx)
- Used `colors.primaryLight` instead of `colors.backgroundSecondary` (matching core).

**10. FIXED: User logs query key pattern** (hooks/useLog.ts)
- Used `['logs', 'user', username]` instead of `['logs', username, 'public']` (matching core).

---

### What Was Correct

- **Optimistic updates:** All mutations have proper optimistic updates with context-based rollback.
- **Stopwatch persistence:** AsyncStorage-based persistence survives app kills and handles corrupted data.
- **Image upload flow:** Two-phase presigned URL approach with XHR progress tracking.
- **Accessibility:** All interactive elements have proper labels and roles.
- **Error handling:** API errors displayed with user-friendly Alert messages.
- **Form validation:** LogSheet validates all required fields before submission.
- **Cache invalidation:** Mutations properly invalidate related queries on success.

### Open Product Questions

- Weekly goal creation still needs product and UX polish.
- Open questions:
- What goal types should exist beyond `days` and `hours`, if any?
- What fields belong in the creation flow versus advanced settings?
- How should goal replacement, editing, and completion history be presented?
- Should the CTA live in one place or be consistent across feed, profile, and onboarding?
- The current implementation is functional, but it should be treated as interim until that flow is specified more clearly.
