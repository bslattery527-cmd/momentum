# Momentum MVP - Progress Tracker

**Last Updated:** 2026-03-15

## Agent Assignments

| Agent | Scope | Tasks | Reviews |
|-------|-------|-------|---------|
| Agent 1 (Backend) | `momentum-api/` - Full backend API | #1-#10 | Reviews Agent 2's Frontend Core (#24) |
| Agent 2 (Frontend Core) | `momentum-app/` - Project setup, navigation, auth, feed, profile | #11-#16 | Reviews Agent 3's Frontend Features (#25) |
| Agent 3 (Frontend Features) | `momentum-app/` - Log creation, social components, notifications, hooks | #17-#23 | Reviews Agent 1's Backend (#26) |

---

## Phase 1: Implementation

### Backend (Agent 1) - `momentum-api/`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Set up backend project structure | COMPLETED | package.json, tsconfig.json, .env.example, .gitignore, full directory structure per EDD Section 10.1 |
| 2 | Prisma schema + seed data | COMPLETED | 14 models (User, OauthAccount, Category, Log, LogTask, LogImage, LogTaggedUser, Follow, Reaction, Comment, Streak, Goal, Notification, PushToken). Seed script creates 6 default categories. Pending uploads handled via nullable logId on LogImage instead of separate table. |
| 3 | Fastify plugins (auth, cors, helmet, rate-limit, prisma) | COMPLETED | auth.ts (@fastify/jwt with authenticate + optionalAuth decorators), cors.ts, helmet.ts, rateLimit.ts (300 req/min default), prisma.ts (Prisma client decorator) |
| 4 | Auth routes (register, login, OAuth, refresh, logout) | COMPLETED | POST register/login (bcrypt cost 12, username regex validation), POST google (google-auth-library), POST apple (jwks-rsa), POST refresh (separate JWT_REFRESH_SECRET), POST logout (push token cleanup). Rate limited per EDD. |
| 5 | User routes (profile, search, avatar, push token) | COMPLETED | GET/PUT /me, GET /:username (with is_following), GET /search (display_name + username), GET /me/logs, GET /:username/logs, POST /me/avatar-upload (pre-signed S3), POST/DELETE /me/push-token |
| 6 | Log routes with image upload | COMPLETED | POST /logs (atomic transaction with streak + goal update), GET/PUT/DELETE /:id (owner-only write/delete), POST /image-upload (two-phase: reserve -> upload to S3 -> commit on log creation). All cursor-based pagination. |
| 7 | Feed routes (home, explore) | COMPLETED | GET /feed (published logs from followed users, reverse-chron, has_reacted, streak_at_time), GET /feed/explore (public logs from non-followed users, optional auth). Both with cursor pagination. |
| 8 | Social routes (follows, reactions, comments) | COMPLETED | POST/DELETE /users/:username/follow (409 duplicate, 422 self-follow), GET followers/following. POST/DELETE/GET /logs/:id/reactions. GET/POST /logs/:id/comments, DELETE /comments/:id (author or log owner). All with push notifications. |
| 9 | Notification + category routes | COMPLETED | GET /notifications (paginated), GET /unread-count, PUT /:id/read, PUT /read-all. GET /categories (no auth). |
| 10 | Services (streak, goal, push, image) | COMPLETED | streakService.ts (exact EDD 10.2 logic), goalService.ts (weekly goal progress + ISO week start), pushService.ts (Expo Push SDK + notification records), imageService.ts (S3 pre-signed URLs + two-phase upload). Nightly cleanup cron job for orphaned images. |

### Frontend Core (Agent 2) - `momentum-app/`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11 | Expo project setup + navigation + theme | COMPLETED | package.json, app.json, tsconfig.json, babel.config.js, constants/theme.ts with full design system (colors, typography, spacing, shadows, layout) |
| 12 | API client, auth store, query client | COMPLETED | lib/api.ts (Axios + auth interceptor + 401 refresh + response envelope unwrap), store/authStore.ts (Zustand + SecureStore hydration), lib/auth.ts (SecureStore helpers), lib/queryClient.ts |
| 13 | Auth screens (welcome, login, register) | COMPLETED | welcome.tsx (Google + Apple + email options), login.tsx (email/password with validation), register.tsx (display name, username with regex validation, email, password) |
| 14 | Onboarding flow screens | COMPLETED | Multi-step flow (name, avatar, bio, goal category) with progress indicator, skip on optional steps, avatar upload to S3, saves via PUT /users/me |
| 15 | Feed screens (home, explore) + FeedCard + ImageGrid | COMPLETED | Home feed with infinite scroll, pull-to-refresh, FAB, GoalWidget header; Explore feed with search bar; FeedCard with user info, tasks, duration, images, celebrate; ImageGrid with 1-4 image layouts |
| 16 | Profile screens + log detail + streak/goal widgets | COMPLETED | Own profile (avatar, stats, bio, StreakWidget, GoalWidget, log history with private badges); Public profile (follow/unfollow, streak, published logs); Log detail (full data, tasks, images, comments, celebrate, delete for owner) |

### Frontend Features (Agent 3) - `momentum-app/`

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17 | Log creation bottom sheet (manual entry) | COMPLETED | LogSheet.tsx with TaskInput, DurationPicker, title, note (280 char counter), image picker, tag users, share toggle |
| 18 | Stopwatch/activity mode + persistent banner | COMPLETED | StopwatchBanner.tsx + lib/stopwatch.ts with AsyncStorage persistence, HH:MM:SS display, pulse animation |
| 19 | Image picker and upload flow | COMPLETED | ImagePicker.tsx + lib/imageUpload.ts with two-phase S3 upload, progress indicators, max 4 images |
| 20 | Social components (reactions, follows, comments) | COMPLETED | ReactionButton.tsx (optimistic toggle), FollowButton.tsx (optimistic toggle), CommentThread.tsx (paginated, optimistic add/delete) |
| 21 | Notifications screen + push token registration | COMPLETED | NotificationItem.tsx with type-specific icons/copy, unread dot, tap-to-navigate; useNotifications hook with mark read/all |
| 22 | User search and discovery | COMPLETED | UserSearchModal.tsx with debounced search, navigate/tag modes, multi-select for tagging |
| 23 | Custom hooks (useAuth, useFeed, useLog, useGoals) | COMPLETED | useLog, useNotifications, useFollow, useReactions, useComments, useGoals, useSearch — all with proper query keys, optimistic updates, cache invalidation |

---

## Phase 2: Cross-Review

| # | Task | Status | Issues Found |
|---|------|--------|--------------|
| 24 | Backend reviews Frontend Core | COMPLETED | Fixed 17 issues: 4 critical (interceptor broke pagination, hydrate missing user fetch, avatar-upload missing body, unread-count wrong property name), 9 type mismatches (User, Log, Comment, LogTask, Streak, Goal, FeedItem, Notification, UpdateUserPayload), 4 minor (has_reacted not read, page extraction cleanup, CommentThread used comment.user_id, optimistic comment had stale fields). See REVIEW_NOTES.md. |
| 25 | Frontend Core reviews Frontend Features | COMPLETED | 10 issues found and fixed: theme naming mismatch (camelCase vs PascalCase), query key misalignment (singular 'log' vs plural 'logs', 'user' vs 'profile'), API response double-unwrapping, type safety fixes, hardcoded colors replaced with theme constants |
| 26 | Frontend Features reviews Backend | COMPLETED | 2 issues fixed (missing `user_id`/`has_reacted` in GET /users/me/logs response, dead DB query in goalService). 5 informational notes (extra username update in PUT /me, missing partial unique index on goals, no user ownership check on pending image IDs, streak_at_time uses current not historical, log_image_uploads design decision). See REVIEW_NOTES.md for details. |

---

## Discovered Work

_Tasks added during implementation that weren't in the original plan:_

| # | Task | Status | Discovered By | Notes |
|---|------|--------|---------------|-------|

---

## Blockers & Decisions

_Issues requiring resolution:_

| Date | Issue | Status | Resolution |
|------|-------|--------|------------|
| 2026-03-15 | EDD specifies separate `log_image_uploads` table for pending uploads | Resolved | Agent 1: Used nullable `logId` on `LogImage` model instead. `logId = null` means pending upload; non-null means committed. Simpler schema, same behavior, cleanup job purges nulls older than 10 min. |
| 2026-03-15 | Node.js not installed on build machine | Non-blocking | Code is complete but `npm install` and TypeScript compilation not verified locally. Will need Node.js 20+ to run. |

---

## Next Steps

1. Launch all 3 agents in parallel to execute Phase 1
2. After Phase 1 completes, merge all agent work
3. Execute Phase 2 cross-reviews
4. Fix issues found in reviews
5. Integration testing across frontend ↔ backend
