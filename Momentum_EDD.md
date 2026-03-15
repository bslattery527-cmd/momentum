# Momentum — Engineering Design Document

**Version 0.1 | Draft | March 2026 | Internal Use Only**

| | |
|---|---|
| **Version** | 0.1 — Draft |
| **Date** | March 2026 |
| **Status** | Pre-Development |
| **Platform** | iOS & Android (React Native / Expo) |
| **Audience** | Engineering Team — Internal Only |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [REST API Specification](#5-rest-api-specification)
6. [Key User Journeys](#6-key-user-journeys)
7. [Frontend Architecture](#7-frontend-architecture-react-native--expo)
8. [Authentication](#8-authentication)
9. [Push Notifications](#9-push-notifications)
10. [Backend Implementation Notes](#10-backend-implementation-notes)
11. [Security](#11-security)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Open Questions & Decisions](#13-open-questions--decisions)
14. [MVP Implementation Checklist](#14-mvp-implementation-checklist)

---

## 1. Overview

Momentum is a mobile application that brings social accountability to personal productivity. Users log discrete work sessions, optionally share them to a social feed, and build habits through community reinforcement — a Strava for productive work.

This EDD defines the full technical specification — architecture, data models, API contract, and key user journeys — so that an engineering team can build the MVP end-to-end without ambiguity.

### 1.1 Scope

MVP covers: Authentication (Google SSO, Apple Sign-In, email/password), work log creation (manual + stopwatch), social feed (home + explore), follow/follower network, reactions and comments, push notifications, streaks and weekly goals, and image attachments on logs.

**Out of scope for MVP:** group challenges, third-party integrations, analytics dashboard (Pro tier), DMs, web app, leaderboards.

### 1.2 Guiding Principles

- Log creation must take under 30 seconds — minimize friction above all else
- Mobile-first. Every design decision optimizes for the phone screen
- Privacy by default — logs are private unless explicitly published
- The social layer must feel earned, not forced
- Design for cold-start — new users with zero follows must get value immediately from Explore

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Mobile | React Native (Expo managed) | Single codebase for iOS & Android; OTA updates via Expo EAS |
| Navigation | React Navigation v6 | De facto standard for RN |
| State Management | Zustand | Lightweight, boilerplate-free |
| Server State / Caching | TanStack Query (React Query) | Handles caching, background refetch, pagination, optimistic updates |
| Backend Runtime | Node.js 20 (LTS) | JS/TS consistency with frontend; large ecosystem |
| Backend Framework | Fastify v4 | Actively maintained; built-in JSON schema validation; ~2x faster than Express; TypeScript-first |
| Database | PostgreSQL 16 | Relational integrity for social graph; JSONB flexibility |
| ORM | Prisma | Type-safe queries; auto-generated migrations |
| Authentication | JWT (access + refresh) + OAuth | Stateless; supports Google and Apple SSO |
| Push Notifications | Expo Push Notifications + APNs/FCM | Abstracts platform differences; free tier sufficient for MVP |
| File Storage | AWS S3 / Cloudflare R2 | Avatar + log image uploads; pre-signed URLs for direct client upload |
| API Format | REST + JSON | Conventional, easy to test |
| Deployment | Railway | Zero-infra managed platform; Postgres included |
| CI/CD | GitHub Actions + Expo EAS Build | Automated builds + OTA on merge to main |

---

## 3. System Architecture

### 3.1 Component Overview

| Component | Responsibility |
|---|---|
| React Native Client (Expo) | All user-facing screens. Communicates with API over HTTPS. Stores access token in SecureStore (iOS Keychain / Android Keystore). |
| REST API (Node.js / Fastify) | Business logic, validation, auth enforcement, notification dispatch. Single deployable service at MVP. |
| PostgreSQL Database | Persistent storage. Never accessed directly from client. |
| AWS S3 / R2 (Object Storage) | Stores user avatars and log images. API issues pre-signed PUT URLs so client uploads directly, reducing API load. |

### 3.2 Architecture Diagram

```
┌─────────────────────────────────────┐
│         React Native App            │
│   (iOS / Android — Expo Managed)    │
└───────────────┬─────────────────────┘
                │ HTTPS / REST + JSON
                ▼
┌──────────────────────────────────────┐
│          REST API (Fastify)          │
│  /api/v1/*  — Auth, Logs, Feed, etc. │
└───────┬───────────────┬──────────────┘
        │               │
        ▼               ▼
┌────────────┐   ┌──────────────────┐
│ PostgreSQL │   │  AWS S3 / R2     │
│  (Railway) │   │  (Avatars +      │
│            │   │   Log Images)    │
└────────────┘   └──────────────────┘
        │
        ▼
┌────────────────────────────┐
│  Expo Push / APNs / FCM   │
│  (Push Notification Hub)  │
└────────────────────────────┘
```

### 3.3 API Versioning

All routes are namespaced under `/api/v1/`. Breaking changes increment the version. The MVP ships with v1 only.

### 3.4 Key Backend Packages

| Package | Purpose |
|---|---|
| `fastify` | Core HTTP framework |
| `@fastify/jwt` | JWT sign/verify; decorates `request.user` |
| `@fastify/cors` | CORS headers |
| `@fastify/helmet` | Security headers |
| `@fastify/rate-limit` | Per-route and global rate limiting |
| `@fastify/multipart` | Multipart form handling (if needed for upload flow) |
| `@prisma/client` + `prisma` | Database ORM |
| `expo-server-sdk` | Expo Push Notifications |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | S3 pre-signed URLs |
| `google-auth-library` | Google ID token verification |
| `jwks-rsa` | Apple Sign-In public key fetching |
| `bcrypt` | Password hashing |
| `node-cron` | Nightly orphan image cleanup job |

### 3.5 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens (min 64 chars) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (different from JWT_SECRET) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `APPLE_CLIENT_ID` | Service ID from Apple Developer account |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_KEY_ID` | Key ID for Sign in with Apple private key |
| `APPLE_PRIVATE_KEY` | Base64-encoded .p8 private key for Sign in with Apple |
| `S3_BUCKET_NAME` | S3/R2 bucket name |
| `S3_REGION` | AWS region (or `auto` for Cloudflare R2) |
| `AWS_ACCESS_KEY_ID` | S3/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | S3/R2 secret key |
| `EXPO_ACCESS_TOKEN` | Expo access token for sending push notifications |

---

## 4. Database Schema

All tables use UUID primary keys (`gen_random_uuid()`) and include `created_at` / `updated_at` timestamps. Cascade rules maintain referential integrity.

### 4.1 Entity Relationship Summary

| Table | Description |
|---|---|
| `users` | Core user accounts. Stores auth credentials, profile, and push token. |
| `oauth_accounts` | Linked OAuth accounts (Google, Apple). One user can have many. |
| `logs` | Work session entries. The atomic unit of Momentum. |
| `log_tasks` | Individual task entries within a session (supports multi-task sessions). |
| `log_images` | Images attached to a log (up to 4). Stores S3 keys and public CDN URLs. |
| `log_tagged_users` | Users tagged in a log entry. |
| `categories` | Predefined categories (Reading, Coding, Writing, etc.). |
| `follows` | Directed follow relationship between two users. |
| `reactions` | A single 'Celebrate' reaction per user per log. |
| `comments` | Comments on a published log. |
| `streaks` | Current and longest streak counters per user. Updated on each log. |
| `goals` | Weekly goals (e.g., log 5 days or 10 hours). One active goal per user. |
| `notifications` | Queued notifications (reactions, comments, follows). |
| `push_tokens` | Device push tokens for Expo / APNs / FCM. |
| `log_image_uploads` | Temporary pending upload records; purged after 10 min if unused. |

### 4.2 Schema Definitions

#### `users`
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT,                     -- NULL for SSO-only accounts
  display_name    TEXT NOT NULL,
  username        TEXT UNIQUE NOT NULL,     -- URL-safe, lowercase
  avatar_url      TEXT,
  bio             TEXT CHECK (char_length(bio) <= 160),
  goal_category   TEXT,                     -- optional onboarding preference
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `oauth_accounts`
```sql
CREATE TABLE oauth_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,            -- 'google' | 'apple'
  provider_id     TEXT NOT NULL,            -- subject from OAuth token
  email           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);
```

#### `categories` (seeded)
```sql
CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  icon            TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed data
INSERT INTO categories (name, icon, is_default) VALUES
  ('Reading',  '📚', TRUE), ('Coding',   '💻', TRUE),
  ('Writing',  '✍️',  TRUE), ('Study',    '🎓', TRUE),
  ('Creative', '🎨', TRUE), ('Other',    '⚡', TRUE);
```

#### `logs`
```sql
CREATE TABLE logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  note            TEXT CHECK (char_length(note) <= 280),
  total_duration  INTEGER NOT NULL DEFAULT 0,  -- total seconds
  started_at      TIMESTAMPTZ,                 -- set when stopwatch used
  ended_at        TIMESTAMPTZ,
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_user_id_created ON logs(user_id, created_at DESC);
CREATE INDEX idx_logs_published ON logs(is_published, published_at DESC);
```

#### `log_tasks`
```sql
CREATE TABLE log_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES categories(id),
  task_name       TEXT NOT NULL,
  duration        INTEGER NOT NULL,  -- seconds
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `log_images`
```sql
-- Up to 4 images per log; ordered by sort_order
CREATE TABLE log_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id       UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  s3_key       TEXT NOT NULL,        -- e.g. 'log-images/<log_id>/<uuid>.jpg'
  public_url   TEXT NOT NULL,        -- CDN URL served to clients
  mime_type    TEXT NOT NULL,        -- 'image/jpeg' | 'image/png' | 'image/webp'
  file_size    INTEGER NOT NULL,     -- bytes
  width        INTEGER,              -- pixels (populated after upload)
  height       INTEGER,              -- pixels
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_images_log ON log_images(log_id, sort_order ASC);

-- Max 4 images per log enforced at the API layer (not DB) for cleaner error messages.
```

#### `log_tagged_users`
```sql
CREATE TABLE log_tagged_users (
  log_id          UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (log_id, user_id)
);
```

#### `follows`
```sql
CREATE TABLE follows (
  follower_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_follows_follower  ON follows(follower_id);
```

#### `reactions`
```sql
-- One 'Celebrate' reaction per user per log
CREATE TABLE reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (log_id, user_id)
);
```

#### `comments`
```sql
CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_log ON comments(log_id, created_at ASC);
```

#### `streaks`
```sql
CREATE TABLE streaks (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_log_date   DATE,     -- UTC date of last qualifying log
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `goals`
```sql
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('days', 'hours')),
  target          INTEGER NOT NULL,        -- e.g. 5 (days) or 600 (minutes)
  week_start      DATE NOT NULL,           -- Monday of the goal week (ISO week)
  days_logged     INTEGER NOT NULL DEFAULT 0,
  minutes_logged  INTEGER NOT NULL DEFAULT 0,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_goals_user_active
  ON goals(user_id) WHERE is_completed = FALSE;
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,   -- 'reaction' | 'comment' | 'follow' | 'tag'
  entity_type     TEXT,            -- 'log' | 'comment'
  entity_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
```

#### `push_tokens`
```sql
CREATE TABLE push_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,   -- Expo push token
  platform        TEXT NOT NULL,          -- 'ios' | 'android'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. REST API Specification

**Base URL:** `https://api.momentum.app/api/v1`

**Auth header:** `Authorization: Bearer <access_token>`

**Response envelope:**
```json
// Success
{ "data": { ... }, "meta": { ... } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

**Pagination:** Cursor-based on all list endpoints.
```
GET /api/v1/feed?limit=20&cursor=2026-03-10T12:00:00Z
```

### 5.1 HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 OK | Request succeeded |
| 201 Created | Resource created |
| 204 No Content | Success, no body (DELETE, reaction toggle) |
| 400 Bad Request | Validation error |
| 401 Unauthorized | Missing or invalid access token |
| 403 Forbidden | Authenticated but not authorized |
| 404 Not Found | Resource does not exist |
| 409 Conflict | Duplicate follow, duplicate reaction, etc. |
| 422 Unprocessable | Semantic error (e.g., follow yourself) |
| 429 Too Many Requests | Rate limit exceeded |
| 500 Internal Server Error | Unexpected error; never expose stack traces |

### 5.2 Authentication

| Method | Endpoint | Description | Auth? |
|---|---|---|---|
| POST | `/auth/register` | Register with email + password | No |
| POST | `/auth/login` | Login with email + password | No |
| POST | `/auth/google` | Exchange Google ID token for Momentum tokens | No |
| POST | `/auth/apple` | Exchange Apple identity token for Momentum tokens | No |
| POST | `/auth/refresh` | Exchange refresh token for new access token | No |
| POST | `/auth/logout` | Revoke push token and invalidate refresh token | Yes |

**POST /auth/register — Request:**
```json
{
  "email":        "user@example.com",
  "password":     "...",              // min 8 chars
  "display_name": "Alex Chen",
  "username":     "alex_chen"         // unique, alphanumeric + underscore
}
```

**POST /auth/register — Response (201):**
```json
{
  "data": {
    "access_token":  "<jwt>",
    "refresh_token": "<jwt>",
    "user": { "id": "...", "username": "alex_chen", "display_name": "Alex Chen", ... }
  }
}
```

**POST /auth/google — Request:**
```json
{ "id_token": "<Google ID token from Expo Auth Session>" }
```

**POST /auth/apple — Request:**
```json
{
  "identity_token": "<Apple identity token>",
  "display_name":   "Alex Chen"   // only populated on first sign-in
}
```

### 5.3 Users

| Method | Endpoint | Description | Auth? |
|---|---|---|---|
| GET | `/users/me` | Get authenticated user's profile | Yes |
| PUT | `/users/me` | Update display name, bio, avatar, goal_category | Yes |
| GET | `/users/:username` | Get a public user profile | Optional |
| GET | `/users/search?q=` | Search by display name or username | Yes |
| POST | `/users/me/push-token` | Register device push token | Yes |
| DELETE | `/users/me/push-token` | Deregister push token on logout | Yes |
| POST | `/users/me/avatar-upload` | Get pre-signed S3 URL for avatar upload | Yes |

**GET /users/:username — Response:**
```json
{
  "data": {
    "id":             "uuid",
    "username":       "alex_chen",
    "display_name":   "Alex Chen",
    "avatar_url":     "https://cdn.../avatar.jpg",
    "bio":            "Building in public.",
    "follower_count":  142,
    "following_count": 89,
    "current_streak":  7,
    "longest_streak":  21,
    "is_following":    true,   // only if request is authenticated
    "log_count":       68
  }
}
```

### 5.4 Logs

| Method | Endpoint | Description | Auth? |
|---|---|---|---|
| POST | `/logs` | Create a new work log | Yes |
| GET | `/logs/:id` | Get a single log | Optional |
| PUT | `/logs/:id` | Update a log (owner only) | Yes |
| DELETE | `/logs/:id` | Delete a log (owner only); cascades reactions/comments/images | Yes |
| GET | `/users/:username/logs` | Get a user's log history | Optional |
| GET | `/users/me/logs` | Get own full log history (public + private) | Yes |
| POST | `/logs/image-upload` | Get pre-signed S3 URLs for up to 4 images | Yes |

**POST /logs/image-upload — Request:**
```json
{
  "images": [
    { "mime_type": "image/jpeg", "file_size": 204800 },  // max 4 items
    { "mime_type": "image/png",  "file_size": 512000 }
  ]
}
```

**POST /logs/image-upload — Response (201):**
```json
{
  "data": [
    {
      "image_id":   "uuid",
      "upload_url": "https://s3.amazonaws.com/...?X-Amz-Signature=...",
      "public_url": "https://cdn.momentum.app/log-images/<uuid>/<uuid>.jpg"
    }
  ]
}
```

**Validation:**
- Max 4 images per request
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max file size per image: 10 MB
- Pre-signed URLs expire in 10 minutes
- Unused upload records are purged by a nightly cleanup job

**POST /logs — Request:**
```json
{
  "title":           "Morning deep work",
  "note":            "Finally cracked the algorithm",   // optional, max 280 chars
  "is_published":    true,                              // default: false
  "started_at":      "2026-03-15T08:00:00Z",           // optional (from stopwatch)
  "ended_at":        "2026-03-15T09:30:00Z",           // optional (from stopwatch)
  "tasks": [                                            // required, min 1 task
    {
      "task_name":    "Leetcode practice",
      "category_id":  "uuid-for-coding",
      "duration":     3600                              // seconds
    },
    {
      "task_name":    "Reading SICP",
      "category_id":  "uuid-for-reading",
      "duration":     1800
    }
  ],
  "tagged_user_ids": ["uuid1", "uuid2"],               // optional
  "image_ids":       ["uuid-a", "uuid-b"]              // optional; from POST /logs/image-upload
}
```

**POST /logs — Response (201):**
```json
{
  "data": {
    "id":             "uuid",
    "user_id":        "uuid",
    "title":          "Morning deep work",
    "note":           "Finally cracked the algorithm",
    "total_duration": 5400,
    "is_published":   true,
    "published_at":   "2026-03-15T08:01:00Z",
    "tasks":          [ { ... } ],
    "images": [
      { "id": "uuid", "public_url": "https://cdn...", "width": 1080, "height": 720, "sort_order": 0 }
    ],
    "tagged_users":   [ { "id": "...", "username": "...", ... } ],
    "reaction_count": 0,
    "comment_count":  0,
    "created_at":     "2026-03-15T08:01:00Z"
  }
}
```

### 5.5 Feed

| Method | Endpoint | Description | Auth? |
|---|---|---|---|
| GET | `/feed` | Home feed: published logs from followed users, reverse-chron | Yes |
| GET | `/feed/explore` | Explore: recent public logs from non-followed users | Optional |

**Query params:** `limit` (default 20, max 50), `cursor` (ISO 8601 timestamp)

Feed card includes: `user`, `title`, `note`, `total_duration`, `tasks[]`, `images[]`, `reaction_count`, `comment_count`, `has_reacted`, `published_at`, `streak_at_time`. Images are returned as an ordered array of `{ id, public_url, width, height }` objects rendered in a grid below the log text (up to 4).

### 5.6 Follows

| Method | Endpoint | Description |
|---|---|---|
| POST | `/users/:username/follow` | Follow (201; 409 if already following; 422 if self) |
| DELETE | `/users/:username/follow` | Unfollow |
| GET | `/users/:username/followers` | List followers |
| GET | `/users/:username/following` | List following |

### 5.7 Reactions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/logs/:id/reactions` | Celebrate a log (triggers push to owner; 409 if already reacted) |
| DELETE | `/logs/:id/reactions` | Remove reaction |
| GET | `/logs/:id/reactions` | List users who celebrated |

### 5.8 Comments

| Method | Endpoint | Description |
|---|---|---|
| GET | `/logs/:id/comments` | Get comments, oldest-first, paginated |
| POST | `/logs/:id/comments` | Post a comment (max 500 chars; triggers notification) |
| DELETE | `/comments/:id` | Delete (comment author OR log owner) |

### 5.9 Streaks & Goals

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me/streak` | Get streak data |
| GET | `/users/me/goals/current` | Get active weekly goal |
| POST | `/users/me/goals` | Create or replace the active weekly goal |

**POST /users/me/goals — Request:**
```json
{ "type": "days", "target": 5 }
// or
{ "type": "hours", "target": 10 }
```

### 5.10 Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | Get notifications (paginated) |
| GET | `/notifications/unread-count` | Get unread count |
| PUT | `/notifications/:id/read` | Mark one notification as read |
| PUT | `/notifications/read-all` | Mark all as read |

### 5.11 Categories

| Method | Endpoint | Description | Auth? |
|---|---|---|---|
| GET | `/categories` | Get the full list of categories | No |

---

## 6. Key User Journeys

### Journey 1: New User Sign-Up & Onboarding

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Welcome | Taps 'Continue with Google' | — | Expo AuthSession opens Google OAuth flow |
| 2 | Welcome | Authenticates with Google | `POST /auth/google` | Account created; tokens stored in SecureStore |
| 3 | Onboarding — Name | Enters display name | — | Local state |
| 4 | Onboarding — Avatar | Optionally taps 'Add Photo' | `POST /users/me/avatar-upload → PUT S3 → PUT /users/me` | Avatar uploaded to S3; profile updated |
| 5 | Onboarding — Bio | Enters optional bio | — | Local state |
| 6 | Onboarding — Goal | Selects a goal category (e.g., Coding) | `PUT /users/me` | Profile saved; `goal_category` set |
| 7 | Explore Feed | Sees popular public logs | `GET /feed/explore` | Cold-start solved: user has content immediately |
| 8 | Explore Feed | Taps 'Follow' on a suggested user | `POST /users/:username/follow` | User followed; home feed now has content |

> **Cold-start handling:** Explore is always populated. Users with zero follows see a "Find people to follow" prompt on the Home tab. Suggested users are surfaced based on `goal_category` match during onboarding.

---

### Journey 2: Create a Work Log (Manual Entry)

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Home Feed | Taps '+' FAB | — | Log creation bottom sheet slides up |
| 2 | Log Sheet | Types task name | — | Local state |
| 3 | Log Sheet | Selects category | `GET /categories` (cached) | Category selected |
| 4 | Log Sheet | Sets duration via picker | — | `duration = 2700` seconds in state |
| 5 | Log Sheet | Types optional reflection note | — | ≤ 280 chars; live counter shown |
| 6 | Log Sheet | Optionally taps 📷 image picker (up to 4) | `POST /logs/image-upload` (per batch) | Pre-signed S3 URLs returned; client uploads each image directly to S3; thumbnails shown inline |
| 7 | Log Sheet | Toggles 'Share to feed' ON | — | `is_published = true` |
| 8 | Log Sheet | Taps 'Log It' | `POST /logs` (with `image_ids[]`) | Log + images committed; streak & goal updated server-side; toast shown |
| 9 | Home Feed | Feed refreshes; log appears with image grid | `GET /feed` (background refetch) | Log visible to followers; images render below the note |

> **Image upload flow:** Images are uploaded in two phases. Phase 1: Client calls `POST /logs/image-upload`; server validates constraints and returns pre-signed S3 PUT URLs. Phase 2: Client uploads each file directly to S3; `image_id`s stored in local state. Phase 3: On 'Log It', `image_ids[]` are passed in `POST /logs`; server moves pending image records to confirmed and associates them with the new log.

> **Streak update logic (server-side):** On every `POST /logs`, check `last_log_date`. If null or yesterday → increment. If today → no change. If older → reset to 1. Update `longest_streak` if exceeded.

---

### Journey 3: Create a Work Log (Stopwatch / Activity Mode)

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Home Feed | Taps '+' FAB | — | Log creation sheet opens |
| 2 | Log Sheet | Taps 'Start Activity' | — | Stopwatch starts; `started_at = now()` stored locally; sheet minimizes to persistent banner |
| 3 | Active Banner | User works; banner shows elapsed time | — | Timer running via Expo TaskManager |
| 4 | Active Banner | Taps 'Stop' on banner | — | `ended_at = now()`; log sheet reopens pre-filled with duration |
| 5 | Log Sheet | Adds task name, category, optional note | — | State populated |
| 6 | Log Sheet | Optionally attaches images (same as Journey 2, Step 6) | `POST /logs/image-upload` | Pre-signed URLs returned; client uploads to S3 |
| 7 | Log Sheet | Taps 'Log It' | `POST /logs` (with `started_at`, `ended_at`, `image_ids[]`) | Log saved with real timestamps; `duration = ended_at − started_at` |

> **Edge case:** If the app is killed mid-session, `started_at` is persisted to AsyncStorage. On relaunch, a "Session in progress" banner is shown and the timer resumes.

---

### Journey 4: Browse Feed & React to a Log

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Home Feed | Scrolls feed (pull-to-refresh) | `GET /feed?limit=20` | Latest logs from followed users load |
| 2 | Feed Card | Reads a log | — | Card shows: avatar, name, task, duration, category, note, images, time ago, reaction count |
| 3 | Feed Card | Taps 🎉 Celebrate | `POST /logs/:id/reactions` | Count increments optimistically; log owner notified |
| 4 | Feed Card | Taps comment count | `GET /logs/:id/comments` | Comment thread opens in modal |
| 5 | Comment Modal | Types a comment and taps 'Post' | `POST /logs/:id/comments` | Comment appears; log owner notified |
| 6 | Feed Card | Taps log owner's avatar | `GET /users/:username` | Navigates to their profile |

> **Optimistic updates:** React Query `useMutation` with `onMutate` updates the feed cache immediately. Rolled back on error.

---

### Journey 5: Discover & Follow a User

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Explore Tab | Taps 'Explore' | `GET /feed/explore` | Public logs from non-followed users |
| 2 | Explore Tab | Taps search icon; types 'design' | `GET /users/search?q=design` | User list appears |
| 3 | Search Results | Taps a user card | `GET /users/:username` | Profile screen opens |
| 4 | Profile | Views log history, streak, following count | `GET /users/:username/logs` | Public logs visible |
| 5 | Profile | Taps 'Follow' | `POST /users/:username/follow` | Button → 'Following'; user added to feed; target notified |

---

### Journey 6: View Own Profile & Streak

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Profile Tab | Taps profile icon | `GET /users/me` + `/me/streak` + `/me/goals/current` | Profile + stats load |
| 2 | Profile | Sees current streak (🔥 7) and longest (21) | — | Rendered from cache |
| 3 | Profile | Sees weekly goal progress (3 of 5 days) | — | Progress bar rendered |
| 4 | Profile | Scrolls log history | `GET /users/me/logs` | All logs (public + private) visible |
| 5 | Profile | Taps a log to see detail | `GET /logs/:id` | Log detail with tasks, images, comments |
| 6 | Profile | Taps '...' → Delete | `DELETE /logs/:id` | Confirmation dialog → log + images deleted |

---

### Journey 7: Set & Track a Weekly Goal

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Home Feed | Sees 'Set a goal' widget | — | Widget CTA visible |
| 2 | Goal Setup | Taps 'Set a goal' | — | Modal slides up |
| 3 | Goal Setup | Selects 'Log 5 days this week' | `POST /users/me/goals` | Goal created at 0/5 |
| 4 | Home Feed | Widget shows progress bar | `GET /users/me/goals/current` (cached) | 0 of 5 |
| 5 | Log Session | User logs a session (Journey 2) | `POST /logs` | Server increments `days_logged`; widget → 1/5 |
| 6 | Home Feed | 5th log of week | — | Confetti animation; 'Goal achieved! 🎉' |

---

### Journey 8: Receive & Act on a Push Notification

| Step | Screen | User Action | API Call | Outcome |
|---|---|---|---|---|
| 1 | Background | Someone celebrates a log | — | Server calls Expo Push API; push sent |
| 2 | Lock Screen | Notification: 'alex_chen celebrated your log 🎉' | — | OS push notification |
| 3 | App (Bell) | Opens app; unread badge on bell | `GET /notifications/unread-count` | Badge shown |
| 4 | Notifications | Taps notification list | `GET /notifications` | List loads |
| 5 | Notifications | Taps a notification row | `PUT /notifications/:id/read` | Marked read; navigates to the relevant log |

---

## 7. Frontend Architecture (React Native / Expo)

### 7.1 Project Structure

```
momentum-app/
├── app/                              # Expo Router file-based routing
│   ├── (auth)/                       # Welcome, Login, Register
│   ├── (onboarding)/                 # Multi-step onboarding
│   ├── (tabs)/                       # Home Feed, Explore, Notifications, Profile
│   ├── users/[username].tsx          # Public user profile
│   └── logs/[id].tsx                 # Log detail + comments
├── components/
│   ├── feed/FeedCard.tsx
│   ├── feed/ImageGrid.tsx            # Up to 4 images in a 2x2 grid
│   ├── log/LogSheet.tsx              # Bottom sheet log creation
│   ├── log/StopwatchBanner.tsx
│   ├── log/ImagePicker.tsx           # expo-image-picker + S3 upload flow
│   ├── profile/StreakWidget.tsx
│   └── profile/GoalWidget.tsx
├── hooks/                            # useAuth, useFeed, useLog, useNotifications
├── lib/
│   ├── api.ts                        # Axios instance + interceptors
│   ├── auth.ts                       # Token storage (SecureStore)
│   ├── imageUpload.ts                # Phase 1+2 of image upload flow
│   └── queryClient.ts
├── store/
│   └── authStore.ts                  # Zustand auth state
└── constants/theme.ts
```

### 7.2 Navigation Structure

| Route | Screen | Auth Required? |
|---|---|---|
| `(auth)/welcome` | Welcome / Sign-in options | No |
| `(auth)/login` | Email + Password Login | No |
| `(auth)/register` | Email Registration | No |
| `(onboarding)/` | Multi-step onboarding | Yes |
| `(tabs)/index` | Home Feed | Yes |
| `(tabs)/explore` | Explore Feed | Optional |
| `(tabs)/notifications` | Notifications | Yes |
| `(tabs)/profile` | Own Profile | Yes |
| `users/[username]` | Any public profile | Optional |
| `logs/[id]` | Log detail + comments | Optional |

### 7.3 State Management

- **Zustand (`authStore`):** Authenticated user object + tokens. Persisted to AsyncStorage. Cleared on logout.
- **TanStack Query:** All server state (feed, logs, profiles). `staleTime = 60s` for feed; `staleTime = 0` for notifications.
- **Local state:** Log creation form, stopwatch timer, pending image uploads.

### 7.4 API Client

A single Axios instance configured with:
- `baseURL: https://api.momentum.app/api/v1`
- Request interceptor: attaches `Authorization: Bearer <token>` from Zustand store
- Response interceptor: on 401, attempts token refresh (`POST /auth/refresh`); if refresh fails, clears auth state and redirects to Welcome

### 7.5 Offline Behavior

- Cached feed data is shown while offline (TanStack Query cache)
- Log creation requires connectivity; toast shown if offline: "Connect to the internet to log your session"
- The active stopwatch continues running offline; log submitted when connectivity resumes
- Image picker is disabled while offline; a tooltip explains why

---

## 8. Authentication

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| Access Token (JWT) | 15 minutes | Memory only (Zustand) | Authorize API requests |
| Refresh Token (JWT) | 30 days | SecureStore (encrypted) | Obtain new access tokens |

Access tokens are **never** written to AsyncStorage or any persistent disk location.

**Google flow:** `expo-auth-session` → Google ID token → `POST /auth/google` → verified with `google-auth-library` → Momentum tokens returned.

**Apple flow:** `expo-apple-authentication` → identity token + `fullName` (first sign-in only) → `POST /auth/apple` → verified against Apple's public keys → Momentum tokens returned.

---

## 9. Push Notifications

| Type | Trigger | Copy |
|---|---|---|
| `reaction` | User A celebrates User B's log | "alex_chen celebrated your log 🎉" |
| `comment` | User A comments on User B's log | "alex_chen commented: '...'" |
| `follow` | User A follows User B | "alex_chen started following you" |
| `tag` | User A tags User B in a log | "alex_chen tagged you in a session" |
| `reminder` | No log by user's set reminder time | "Time to log your session today! 🔥" |

**Rules:**
- Never notify a user about their own action
- Batch reactions: 3+ on the same log within 5 min → single notification ("alex_chen and 2 others celebrated your log")
- Reminders fire at most once per day per user

---

## 10. Backend Implementation Notes

### 10.1 Project Structure

Fastify uses a plugin-based architecture. Each route file is a Fastify plugin registered with `fastify.register()`. Validation is declared inline via JSON Schema on each route — no separate validation middleware needed.

```
momentum-api/
├── src/
│   ├── app.ts                        # Fastify instance, plugin registration
│   ├── plugins/
│   │   ├── auth.ts                   # @fastify/jwt — decorates request.user
│   │   ├── cors.ts                   # @fastify/cors
│   │   ├── rateLimit.ts              # @fastify/rate-limit
│   │   ├── helmet.ts                 # @fastify/helmet
│   │   └── prisma.ts                 # Prisma client as Fastify decorator
│   ├── routes/
│   │   ├── auth.ts                   # each file: FastifyPluginAsync
│   │   ├── users.ts
│   │   ├── logs.ts                   # includes /image-upload
│   │   ├── feed.ts
│   │   ├── follows.ts
│   │   ├── reactions.ts
│   │   ├── comments.ts
│   │   ├── goals.ts
│   │   ├── notifications.ts
│   │   └── categories.ts
│   ├── schemas/
│   │   ├── log.schema.ts             # JSON Schema for log routes
│   │   ├── user.schema.ts            # reused across routes via $ref
│   │   └── auth.schema.ts
│   ├── services/
│   │   ├── streakService.ts
│   │   ├── goalService.ts
│   │   ├── imageService.ts           # pre-signed URL generation + S3 cleanup
│   │   └── pushService.ts
│   ├── jobs/
│   │   └── cleanupOrphanImages.ts    # nightly cron
│   └── lib/
│       ├── prisma.ts
│       └── jwt.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── package.json
```

### 10.2 Streak Service Logic

```typescript
// Called inside a transaction on every POST /logs
async function updateStreak(userId: string, tx: PrismaTransaction) {
  const today = new Date().toISOString().split('T')[0]; // UTC date
  const streak = await tx.streak.findUnique({ where: { userId } });

  if (!streak || !streak.lastLogDate) {
    return tx.streak.upsert({ where: { userId },
      create: { userId, currentStreak: 1, longestStreak: 1, lastLogDate: today },
      update: { currentStreak: 1, longestStreak: 1, lastLogDate: today }
    });
  }

  const last = streak.lastLogDate.toISOString().split('T')[0];
  if (last === today) return streak; // already logged today

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newCurrent = last === yesterday ? streak.currentStreak + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestStreak);

  return tx.streak.update({ where: { userId },
    data: { currentStreak: newCurrent, longestStreak: newLongest, lastLogDate: today }
  });
}
```

### 10.3 Image Storage Architecture

Images follow a two-phase upload pattern to keep the core log creation endpoint fast.

| Phase | Actor | Action | Outcome |
|---|---|---|---|
| 1 — Reserve | Client → API | `POST /logs/image-upload` with `[{mime_type, file_size}]` | Server creates pending `log_image` records; returns pre-signed S3 PUT URLs (10 min TTL) |
| 2 — Upload | Client → S3 | `PUT` image binary to each pre-signed URL | Image stored at `s3://bucket/log-images/<uuid>/<uuid>.jpg` |
| 3 — Commit | Client → API | `POST /logs` with `image_ids[]` | Server updates `log_image.log_id` to the new log; records become permanent |
| 4 — Cleanup | Cron (nightly) | Delete pending `log_images` older than 10 min | Orphaned records and S3 objects purged |

**S3 key structure:** `log-images/<log_id>/<image_uuid>.<ext>`

**CDN:** Images served through CloudFront or Cloudflare in front of S3. `public_url` in the API response is always the CDN URL, never the raw S3 URL.

**Constraints enforced at the API layer:**
- Max 4 images per log
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max file size: 10 MB per image
- Pre-signed upload URLs expire after 10 minutes
- S3 bucket is private; all reads go through CDN

### 10.4 Feed Query

```sql
-- Home feed (simplified)
SELECT l.*, u.username, u.display_name, u.avatar_url,
       COUNT(DISTINCT r.id)  AS reaction_count,
       COUNT(DISTINCT c.id)  AS comment_count,
       EXISTS (SELECT 1 FROM reactions r2
               WHERE r2.log_id = l.id AND r2.user_id = $authUserId) AS has_reacted
FROM   logs l
JOIN   users u  ON u.id = l.user_id
JOIN   follows f ON f.following_id = l.user_id AND f.follower_id = $authUserId
LEFT   JOIN reactions r ON r.log_id = l.id
LEFT   JOIN comments  c ON c.log_id = l.id
WHERE  l.is_published = TRUE
  AND  ($cursor IS NULL OR l.published_at < $cursor)
GROUP  BY l.id, u.id
ORDER  BY l.published_at DESC
LIMIT  $limit;
-- Images are fetched in a separate query per log (or via lateral join) to avoid row multiplication
```

### 10.5 Rate Limits

Rate limiting is applied via `@fastify/rate-limit`, registered as a plugin with per-route overrides where needed.


| Route | Limit |
|---|---|
| `POST /auth/login`, `/auth/register` | 10 req / 15 min per IP |
| `POST /auth/google`, `/auth/apple` | 20 req / 15 min per IP |
| `POST /logs` | 60 req / hour per user |
| `POST /logs/image-upload` | 60 req / hour per user |
| `POST /logs/:id/reactions` | 120 req / hour per user |
| `POST /logs/:id/comments` | 60 req / hour per user |
| `GET *` | 300 req / min per user |

---

## 11. Security

### Authorization Rules

| Resource | Rule |
|---|---|
| Log (read) | Anyone can read a published log. Only owner can read private logs. |
| Log (write/delete) | Owner only. Deleting a log cascades to images (S3 objects deleted async). |
| User profile (read) | Public fields readable by anyone. Email never exposed. |
| User profile (write) | Only the authenticated user can update their own profile. |
| Comments (delete) | Comment author OR log owner. |
| Feed | Home feed requires auth. Explore allows unauthenticated access (reduced rate limit). |
| Log images | Only accessible via CDN URLs. Raw S3 URLs never exposed. |

### Additional Measures

- Passwords hashed with bcrypt (cost factor 12)
- JWT secrets ≥ 64 chars, randomly generated, never committed to version control
- HTTPS enforced on all API and CDN traffic
- CORS: Expo app origin only (plus localhost in development)
- Security headers via `@fastify/helmet`
- Avatar and log image pre-signed upload URLs expire in 10 minutes; only `.jpg`, `.png`, `.webp` accepted
- Username must match `/^[a-z0-9_]{3,30}$/`
- All request/response bodies validated via Fastify's built-in JSON Schema validation (declared per-route); no separate Zod dependency needed

---

## 12. Infrastructure & Deployment

### Environments

| Environment | Purpose | Notes |
|---|---|---|
| development | Local development | Local Postgres via Docker |
| staging | Pre-production QA | Mirrors production; used for TestFlight / internal builds |
| production | Live user traffic | Railway; DB backups every 24 hours |

### CI/CD Pipeline

1. On PR: TypeScript type check + ESLint + Jest via GitHub Actions
2. On merge to main: auto-deploy API to Railway staging
3. On tag (`vX.Y.Z`): Expo EAS Build for iOS + Android → TestFlight + Google Play internal track
4. Database migrations run automatically via `prisma migrate deploy` in Railway start command

### Monitoring

- Railway: built-in CPU, memory, response time metrics
- Error tracking: Sentry (Node.js SDK for API; Expo SDK for mobile)
- Uptime: Better Uptime pinging `/health` every 60 seconds

---

## 13. Open Questions & Decisions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Default experience for zero-follows user? | Show Explore as default tab until 3+ follows. Suggest users by `goal_category` in onboarding. |
| Q2 | Chronological or algorithmic feed? | Ship reverse-chronological only. 'Hot' sort for Explore tab is a fast follow-on. |
| Q3 | Pro pricing — monthly vs annual? | Defer to post-MVP. Build paywall UI as a stub. No Pro features at MVP. |
| Q4 | Feed opt-in or opt-out by default? | Default to private. 'Share to feed' toggle defaults OFF for first 3 logs, then ON. |
| Q5 | Comment moderation? | 'Report' button on comments (`POST /comments/:id/report`). Manual queue + `bad-words` npm baseline. Required for App Store approval. |
| Q6 | Simultaneous iOS + Android launch? | Yes — Expo EAS makes this low-cost. Stagger App Store review submissions by 1 week as a hedge. |

---

## 14. MVP Implementation Checklist

### Backend

| Item | PRD Ref | Status |
|---|---|---|
| Database schema + Prisma migration | All | TODO |
| Seed categories table | L-6 | TODO |
| `POST /auth/register`, `/auth/login` | A-4 | TODO |
| `POST /auth/google` | A-1 | TODO |
| `POST /auth/apple` | A-2 | TODO |
| `POST /auth/refresh`, `/auth/logout` | A-1 | TODO |
| `GET/PUT /users/me`, `GET /users/:username` | F-8 | TODO |
| `GET /users/search` | F-1 | TODO |
| `POST /users/me/avatar-upload` | A-3 | TODO |
| `POST /logs/image-upload` (pre-signed S3 URLs, validation, pending records) | L-0 | TODO |
| `POST /logs`, `GET /logs/:id`, `PUT/DELETE /logs/:id` (with `image_ids[]`) | L-0, L-1 | TODO |
| Nightly cron: purge orphaned pending `log_image` records + S3 objects | L-0 | TODO |
| `GET /users/:username/logs`, `GET /users/me/logs` | L-7 | TODO |
| `GET /feed`, `GET /feed/explore` | F-2, F-7 | TODO |
| `POST/DELETE /users/:username/follow` | F-1 | TODO |
| `POST/DELETE /logs/:id/reactions` | F-4 | TODO |
| `GET/POST /logs/:id/comments`, `DELETE /comments/:id` | F-5 | TODO |
| Streak service (`updateStreak` on `POST /logs`) | S-1, S-2 | TODO |
| `POST /users/me/goals`, `GET /users/me/goals/current` | S-3, S-4 | TODO |
| Goal service (`updateGoal` on `POST /logs`) | S-3 | TODO |
| `GET /notifications`, `PUT` read/read-all | F-6 | TODO |
| Push notification dispatch (reaction, comment, follow, tag) | F-6 | TODO |
| Reminder push notification (daily, opt-in) | S-5 | TODO |
| `GET /categories` | L-6 | TODO |

### Frontend

| Item | PRD Ref | Status |
|---|---|---|
| Expo project setup (managed, TypeScript) | All | TODO |
| Axios API client + auth interceptors | All | TODO |
| Zustand auth store + SecureStore persistence | A-1–A-4 | TODO |
| Welcome / login / register screens | A-1–A-4 | TODO |
| Google Sign-In (`expo-auth-session`) | A-1 | TODO |
| Apple Sign-In (`expo-apple-authentication`) | A-2 | TODO |
| Multi-step onboarding flow | A-3 | TODO |
| Bottom tab navigator (Home, Explore, Notifications, Profile) | All | TODO |
| Home Feed screen + FeedCard component | F-2, F-3 | TODO |
| Explore Feed screen | F-7 | TODO |
| Log creation bottom sheet (manual entry) | L-0, L-1, L-3, L-4 | TODO |
| Stopwatch / Activity mode + persistent banner | L-0 | TODO |
| Multi-task session support in log sheet | L-5 | TODO |
| Image picker in log sheet (`expo-image-picker`, max 4, upload to S3 pre-signed URLs) | L-0 | TODO |
| Image grid display in FeedCard and log detail view (up to 4 images) | F-3 | TODO |
| Tag users in log creation | L-8 | TODO |
| Celebrate reaction button (optimistic) | F-4 | TODO |
| Comment thread modal | F-5 | TODO |
| User profile screen (public + own) | F-8 | TODO |
| Follow / Unfollow button (optimistic) | F-1 | TODO |
| Streak widget on profile | S-1, S-2 | TODO |
| Weekly goal widget on home feed | S-3, S-4 | TODO |
| Notifications screen + unread badge | F-6 | TODO |
| Push token registration on launch | F-6 | TODO |
| User search / discovery | F-1 | TODO |

---

*Momentum EDD v0.1 | March 2026 | Internal Use Only*