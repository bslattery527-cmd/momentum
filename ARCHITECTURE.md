# Momentum - System Architecture & File Map

**Purpose:** Quick-reference for agents to understand the system and locate key files.

---

## Repository Structure

```
momentum/
├── CLAUDE.md                    # Project-level Claude Code instructions
├── PROGRESS.md                  # Build progress tracker
├── ARCHITECTURE.md              # This file - system map
├── Momentum_EDD.md              # Engineering Design Document (source of truth)
├── momentum-api/                # Backend (Node.js / Fastify / Prisma)
│   ├── src/
│   │   ├── app.ts               # Fastify instance, plugin registration, route registration
│   │   ├── server.ts            # Entry point - starts the server
│   │   ├── plugins/             # Fastify plugins (registered in app.ts)
│   │   │   ├── auth.ts          # JWT auth - decorates request.user
│   │   │   ├── cors.ts          # CORS configuration
│   │   │   ├── helmet.ts        # Security headers
│   │   │   ├── rateLimit.ts     # Rate limiting
│   │   │   └── prisma.ts       # Prisma client as decorator
│   │   ├── routes/              # API route handlers (each is a FastifyPluginAsync)
│   │   │   ├── auth.ts          # /auth/* - register, login, OAuth, refresh, logout
│   │   │   ├── users.ts         # /users/* - profiles, search, avatar, push token
│   │   │   ├── logs.ts          # /logs/* - CRUD, image upload
│   │   │   ├── feed.ts          # /feed, /feed/explore
│   │   │   ├── follows.ts       # Follow/unfollow, follower/following lists
│   │   │   ├── reactions.ts     # Celebrate toggle + list
│   │   │   ├── comments.ts      # Comment CRUD
│   │   │   ├── goals.ts         # Weekly goals + streaks
│   │   │   ├── notifications.ts # Notification list, read/unread
│   │   │   └── categories.ts   # Category list (public)
│   │   ├── schemas/             # JSON Schema for route validation
│   │   │   ├── auth.schema.ts
│   │   │   ├── user.schema.ts
│   │   │   └── log.schema.ts
│   │   ├── services/            # Business logic
│   │   │   ├── streakService.ts # Streak update on log creation
│   │   │   ├── goalService.ts   # Goal progress on log creation
│   │   │   ├── pushService.ts   # Expo push notifications
│   │   │   └── imageService.ts  # S3 pre-signed URLs + orphan cleanup
│   │   ├── jobs/
│   │   │   └── cleanupOrphanImages.ts  # Nightly cron
│   │   └── lib/
│   │       ├── prisma.ts        # Prisma client singleton
│   │       └── jwt.ts           # JWT helpers
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema (13+ models)
│   │   └── seed.ts              # Seeds categories table
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── momentum-app/                # Frontend (React Native / Expo)
    ├── app/                     # Expo Router file-based routing
    │   ├── _layout.tsx          # Root layout (providers, auth gate)
    │   ├── (auth)/              # Unauthenticated screens
    │   │   ├── _layout.tsx
    │   │   ├── welcome.tsx      # Landing with Google/Apple/email options
    │   │   ├── login.tsx        # Email + password
    │   │   └── register.tsx     # Registration form
    │   ├── (onboarding)/        # Post-signup onboarding
    │   │   ├── _layout.tsx
    │   │   └── index.tsx        # Multi-step: name, avatar, bio, goal category
    │   ├── (tabs)/              # Main tab navigation
    │   │   ├── _layout.tsx      # Tab bar config
    │   │   ├── index.tsx        # Home feed
    │   │   ├── explore.tsx      # Explore feed
    │   │   ├── notifications.tsx # Notifications list
    │   │   └── profile.tsx      # Own profile
    │   ├── users/
    │   │   └── [username].tsx   # Public user profile
    │   └── logs/
    │       └── [id].tsx         # Log detail + comments
    ├── components/
    │   ├── feed/
    │   │   ├── FeedCard.tsx      # Log card in feed
    │   │   └── ImageGrid.tsx    # 1-4 image grid layout
    │   ├── log/
    │   │   ├── LogSheet.tsx     # Bottom sheet for log creation
    │   │   ├── StopwatchBanner.tsx # Active session banner
    │   │   ├── ImagePicker.tsx  # Image selection + upload
    │   │   ├── TaskInput.tsx    # Task name + category + duration
    │   │   └── DurationPicker.tsx # Hours:minutes picker
    │   ├── profile/
    │   │   ├── StreakWidget.tsx  # Streak display
    │   │   └── GoalWidget.tsx   # Goal progress bar
    │   ├── common/
    │   │   ├── ReactionButton.tsx  # Celebrate toggle
    │   │   ├── FollowButton.tsx    # Follow/unfollow
    │   │   ├── CommentThread.tsx   # Comment list + input
    │   │   └── UserSearchModal.tsx # User search
    │   └── notifications/
    │       └── NotificationItem.tsx
    ├── hooks/
    │   ├── useAuth.ts           # Auth mutations (login, register, OAuth)
    │   ├── useFeed.ts           # Feed queries (home, explore)
    │   ├── useLog.ts            # Log CRUD + image upload
    │   ├── useNotifications.ts  # Notification queries + mutations
    │   ├── useFollow.ts         # Follow/unfollow mutations
    │   ├── useReactions.ts      # Reaction toggle mutation
    │   ├── useComments.ts       # Comment queries + mutations
    │   ├── useGoals.ts          # Goal + streak queries
    │   └── useSearch.ts         # User search query
    ├── lib/
    │   ├── api.ts               # Axios instance + auth interceptors
    │   ├── auth.ts              # SecureStore token helpers
    │   ├── queryClient.ts       # TanStack Query config
    │   ├── imageUpload.ts       # S3 upload flow
    │   └── stopwatch.ts         # Timer + AsyncStorage persistence
    ├── store/
    │   └── authStore.ts         # Zustand auth state
    └── constants/
        └── theme.ts             # Colors, spacing, typography
```

---

## Key Technical Decisions

| Decision | Details |
|----------|---------|
| **Auth** | JWT (access: 15min memory-only, refresh: 30d SecureStore). Google/Apple OAuth via Expo libraries |
| **API** | REST + JSON, `/api/v1/` prefix, cursor-based pagination, response envelope `{data, meta}` or `{error}` |
| **State** | Zustand for auth state, TanStack Query for all server state |
| **Images** | Two-phase upload: reserve pre-signed URLs → upload to S3 → commit with log |
| **Streaks** | Updated server-side on every POST /logs in a transaction |
| **Feed** | Home = followed users' published logs; Explore = non-followed users |
| **Privacy** | Logs private by default; "Share to feed" toggle defaults OFF for first 3 logs |

---

## Environment Variables (Backend)

See `momentum-api/.env.example` for the full list. Key ones:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Token signing (min 64 chars each)
- `GOOGLE_CLIENT_ID` / `APPLE_*` - OAuth credentials
- `S3_*` / `AWS_*` - Object storage
- `EXPO_ACCESS_TOKEN` - Push notifications

---

## Database Models (13 tables)

`users` → `oauth_accounts` → `logs` → `log_tasks`, `log_images`, `log_tagged_users` → `follows` → `reactions` → `comments` → `streaks` → `goals` → `notifications` → `push_tokens`

See `Momentum_EDD.md` Section 4 for full schema or `momentum-api/prisma/schema.prisma` for Prisma models.

---

## API Endpoints Summary

| Group | Endpoints | Auth |
|-------|-----------|------|
| Auth | POST register, login, google, apple, refresh, logout | No (except logout) |
| Users | GET/PUT me, GET :username, GET search, POST avatar-upload, POST/DELETE push-token | Yes (except GET :username) |
| Logs | POST, GET/:id, PUT/:id, DELETE/:id, GET user logs, POST image-upload | Yes (GET optional for published) |
| Feed | GET /feed (home), GET /feed/explore | Yes / Optional |
| Follows | POST/DELETE follow, GET followers/following | Yes |
| Reactions | POST/DELETE/GET reactions | Yes |
| Comments | GET/POST/DELETE comments | Yes |
| Goals | POST goal, GET current goal, GET streak | Yes |
| Notifications | GET list, GET unread-count, PUT read, PUT read-all | Yes |
| Categories | GET list | No |

Full API spec: `Momentum_EDD.md` Section 5
