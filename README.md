# Biman GSE Digital Logbook API

NestJS API for the Biman GSE maintenance logbook. The application uses Prisma with PostgreSQL, Redis-backed BullMQ notification dispatch, authenticated Server-Sent Events, JWT access/refresh tokens, Swagger, and private local file storage. The Next.js UI is in the sibling `biman-ui` project.

## Requirements

- Node.js 20 or newer
- pnpm 10.27.0 (pinned in `package.json`)
- PostgreSQL and Redis

## Local setup

1. Create a `.env` file with the database/Redis connection URLs, two distinct strong JWT secrets, bootstrap-admin values, and any desired optional settings. The workspace `.env` may already contain private connection URLs; it is git-ignored. Never commit secrets.

   ```dotenv
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=replace-with-a-long-random-secret
   JWT_REFRESH_SECRET=use-a-different-long-random-secret
   BOOTSTRAP_ADMIN_EMAIL=admin@example.test
   BOOTSTRAP_ADMIN_NAME=Local Admin
   BOOTSTRAP_ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
   ```

   Optional configuration includes `PORT` (default `3001`), `CORS_ORIGIN` (default `http://localhost:3000`; comma-separated origins are accepted), `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL_DAYS` (default `30`), `LOCAL_UPLOAD_ROOT` (default `./var/uploads`), and `STORAGE_QUOTA_BYTES` (default 10 GiB).

2. Install dependencies and generate Prisma Client:

   ```bash
   pnpm install
   pnpm run db:generate
   ```

3. Review the migration in `prisma/migrations/`, back up the target database, then apply migrations intentionally:

   ```bash
   pnpm run db:migrate:deploy
   ```

   This changes the PostgreSQL database selected by `DATABASE_URL`. Do not run against production until the SQL and a database backup have been reviewed.

4. Confirm `DATABASE_URL` points to a local development/test database, then seed the initial Super Admin and shared PM checklists:

   ```bash
   pnpm run db:seed
   ```

   The seed requires `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 12 characters. To add repeatable demo equipment, tickets, a parts request, and a maintenance schedule, enable `SEED_DEMO_DATA` for that seed run. Demo seeding is blocked when `NODE_ENV=production`.

   PowerShell:
   ```powershell
   $env:SEED_DEMO_DATA = "true"; pnpm run db:seed; Remove-Item Env:SEED_DEMO_DATA
   ```

   Bash:
   ```bash
   SEED_DEMO_DATA=true pnpm run db:seed
   ```

5. Start the API:

   ```bash
   pnpm run dev
   ```

The API defaults to `http://localhost:3001/api`; Swagger UI is at `/api/docs`, and readiness is checked at `/api/health`. Uploaded files are stored outside the public web root under `LOCAL_UPLOAD_ROOT`.

## API surface

All routes are under `/api`. Login, refresh, and health are public; other routes require `Authorization: Bearer <accessToken>`. An account with `mustChangePassword=true` can access only the password-change-enabled routes until its temporary password is changed.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/password` |
| Users | `/users/me`, `/users/me/password`, `/users`, `/users/engineers`, `/users/:id` and the documented status/password/reset subroutes |
| Equipment types | `/equipment-types` and `/equipment-types/:id` |
| Equipment | `/equipment`, `/equipment/:id`, `/equipment/:id/hour-meter`, `/equipment/:id/hour-meter/service-check` |
| Tickets | `/tickets`, `/tickets/:id`, and assignment, maintenance, checklist, feedback, submit, verify-close, and return subroutes |
| Requests | `/requests` and `/:id/approve`, `/:id/reject`, `/:id/receive` |
| Schedules | `/maintenance-schedules` |
| Notifications | `/notifications`, `/notifications/stream`, `/:id/read`, `/read-all` |
| Reports | `/reports/summary` |
| Files | `/files/images`, `/files/documents`, `/files/:id/attach`, `/files/:id`, `/files/:id/thumbnail`, `/files/usage` |

See `/api/docs` for HTTP methods, request DTOs, permissions, and response schemas. Paginated endpoints generally accept `page` (default 1), `limit` (default 20, maximum 100), `search`, and `order` (`asc`/`desc`); supported filters vary by endpoint.

## Implemented behavior and known issue

- Equipment meter updates accept only a value strictly greater than the current reading and append a history row. Updating the meter does not itself create a PM ticket; service-check is an explicit action.
- Manual tickets are Breakdown, General, or Washing. PM tickets use the hour-meter service-check or V-Service schedule workflows.
- V-Service schedules are checked by a ten-minute cron task. Notifications are persisted, dispatched through BullMQ/Redis, and streamed to each authenticated user over SSE.
- **Known defect:** service-check currently expects `dueDateByServiceId` to be a JSON object keyed by service ID, but the DTO validates the field as a string. The documented object payload is therefore rejected by request validation (HTTP 400). See `../docs/BACKEND_SPEC.md` and `../docs/UAT_CHECKLIST.md` for impact and the recorded UAT results.
- **User-status note:** the admin UI uses `PATCH /users/:id/status` to deactivate accounts; this route revokes refresh tokens. The Super Admin `PATCH /users/:id` DTO also permits direct API status changes but does not revoke refresh tokens, so that alternate route needs coverage/fixing.
- See the backend specification and UAT checklist for role behavior, current implementation details, and remaining verification gaps.

## Useful commands

- `pnpm run build` — compile the API.
- `pnpm run lint` — lint TypeScript sources.
- `pnpm test -- --runInBand` — run unit tests serially.
- `pnpm run test:e2e` — run the configured API end-to-end suite.
- `pnpm run db:generate` — regenerate Prisma Client.
- `pnpm run db:migrate:dev` — create/apply a development migration.
- `pnpm run db:migrate:deploy` — apply committed migrations in deployment.
- `pnpm run db:seed` — seed the bootstrap Super Admin and shared checklist data.
- `pnpm run db:studio` — open Prisma Studio.
