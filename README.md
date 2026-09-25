# Biman GSE Digital Logbook API

NestJS backend for the Biman GSE maintenance logbook. It uses Prisma with PostgreSQL, Redis-backed BullMQ configuration, JWT access/refresh tokens, Swagger, and private local file storage.

## Local setup

1. Install Node.js 20+ and pnpm 10.27.0 (the version pinned in `package.json` as the project package manager).
2. Set the PostgreSQL/Redis URLs and two distinct strong JWT secrets in `.env`. The workspace `.env` already contains the connection URLs supplied for this project and is git-ignored.
3. Install dependencies and generate Prisma Client:

   ```bash
   pnpm install
   pnpm run db:generate
   ```

4. Review `prisma/migrations/20260925000000_init/migration.sql`, back up the target database, and then apply migrations intentionally:

   ```bash
   pnpm run db:migrate:deploy
   ```

   This command changes the PostgreSQL database selected by `DATABASE_URL`. Do not run it against a production database until the SQL and backup have been reviewed.

5. Set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 12 characters, then run `pnpm run db:seed` once to create the initial Super Admin and shared PM checklists. To add repeatable demo equipment, tickets, a parts request, and a maintenance schedule, enable `SEED_DEMO_DATA` for the seed run. Demo seeding is blocked when `NODE_ENV=production`. Confirm `DATABASE_URL` points to your development/test database before seeding.

   PowerShell:
   ```powershell
   $env:SEED_DEMO_DATA = "true"; pnpm run db:seed; Remove-Item Env:SEED_DEMO_DATA
   ```

   Bash:
   ```bash
   SEED_DEMO_DATA=true pnpm run db:seed
   ```

6. Start the API with `pnpm run dev`.

The API is served under `/api`; Swagger UI is at `/api/docs`, and readiness is checked at `/api/health`. Uploaded files are kept outside the public web root under `LOCAL_UPLOAD_ROOT`.

## Useful commands

- `pnpm run build` — compile the API.
- `pnpm exec jest --runInBand` — unit tests.
- `pnpm run lint` — lint TypeScript sources.
- `pnpm run db:generate` — regenerate Prisma Client.
- `pnpm run db:migrate:deploy` — apply committed migrations in deployment.
- `pnpm run db:studio` — open Prisma Studio.

## Initial API surface

- Auth and users: `/api/auth/*`, `/api/users/*` (Super Admin user creation, status and temporary-password reset)
- Equipment types and assets: `/api/equipment-types/*`, `/api/equipment/*`
- Tickets/work records: `/api/tickets/*`
- Parts requests: `/api/requests/*`
- Notifications, schedules, reports, and files: `/api/notifications/*`, `/api/maintenance-schedules/*`, `/api/reports/*`, `/api/files/*`

JWT-protected endpoints require `Authorization: Bearer <accessToken>`. New accounts must change their temporary password before accessing other protected routes.
