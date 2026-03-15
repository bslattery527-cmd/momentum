# momentum

Project-level Claude Code configuration.

## Project Overview

Momentum is a mobile app that brings social accountability to personal productivity. Users log work sessions, share them to a social feed, and build habits through community reinforcement (a "Strava for productive work").

- Full spec: `Momentum_EDD.md`
- Architecture & file map: `ARCHITECTURE.md`
- Build progress: `PROGRESS.md`

## Tech Stack

**Backend (`momentum-api/`):**
- Node.js 20 + TypeScript + Fastify v4
- PostgreSQL 16 via Prisma ORM
- JWT auth (access + refresh tokens)
- AWS S3/R2 for image storage
- Expo Push Notifications

**Frontend (`momentum-app/`):**
- React Native (Expo managed) + TypeScript
- Expo Router (file-based navigation)
- Zustand (auth state) + TanStack Query (server state)
- Axios (HTTP client)

## Development Setup

```bash
# Backend
cd momentum-api
npm install
cp .env.example .env  # Fill in env vars
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend
cd momentum-app
npm install
npx expo start
```

## Commands

### Backend (`momentum-api/`)
- `npm run dev` — start dev server with hot reload
- `npm run build` — compile TypeScript
- `npm start` — start production server
- `npx prisma migrate dev` — run migrations
- `npx prisma db seed` — seed categories
- `npx prisma studio` — database GUI

### Frontend (`momentum-app/`)
- `npx expo start` — start Expo dev server
- `npx expo start --ios` — run on iOS simulator
- `npx expo start --android` — run on Android emulator

## Conventions

- API routes are namespaced under `/api/v1/`
- Response envelope: `{ data: {...} }` for success, `{ error: { code, message, details } }` for errors
- Cursor-based pagination on all list endpoints
- Each route file is a `FastifyPluginAsync` registered via `fastify.register()`
- Validation via Fastify's built-in JSON Schema (no Zod)
- Username format: `/^[a-z0-9_]{3,30}$/`
- Passwords: bcrypt cost factor 12
- Images: two-phase upload (reserve pre-signed URL → upload to S3 → commit with log)

## Notes for Claude

- Always check `Momentum_EDD.md` for the authoritative specification on any feature
- Check `ARCHITECTURE.md` for the file map and where things live
- Check `PROGRESS.md` for current build status and what's been completed
- Backend and frontend are separate projects in `momentum-api/` and `momentum-app/`
- All database models are defined in `momentum-api/prisma/schema.prisma`
- When modifying API endpoints, ensure both backend route and frontend hook/API call stay in sync
