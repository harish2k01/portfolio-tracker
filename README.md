# Portfolio Tracker

Authenticated India-only portfolio tracker for SIPs, Indian mutual funds, NSE/BSE stocks, India-listed ETFs, allocation analytics, SIP reminders, and watchlist alerts.

## Stack

- Next.js App Router, TypeScript, TailwindCSS
- shadcn-style local UI primitives in `src/components/ui`
- Recharts for charts
- Prisma ORM with PostgreSQL
- NextAuth Credentials login with bcrypt password hashing

## Setup

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

Set these values in `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_tracker?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
```

Open [http://localhost:3000](http://localhost:3000). The first signup creates the admin user and disables public signup. The admin can reopen signup and activate/deactivate users from the Admin tab.

## Docker

```bash
docker compose up --build
```

The app runs at [http://localhost:3000](http://localhost:3000). Compose starts PostgreSQL in the `db` service, stores data in the `postgres_data` volume, and exposes Postgres on host port `5432` by default.

If port `5432` is already in use, set `DB_PORT`:

```bash
$env:DB_PORT="5433"
docker compose up --build
```

If port `3000` is already in use, choose another host port and match `NEXTAUTH_URL`:

```bash
$env:APP_PORT="3002"
$env:DOCKER_NEXTAUTH_URL="http://localhost:3002"
docker compose up --build
```

Set a stronger auth secret before running a persistent instance:

```bash
$env:NEXTAUTH_SECRET="replace-this-with-a-long-random-secret"
docker compose up --build
```

The web container applies Prisma migrations automatically before starting Next.js.

## Data Sources

The app does not ship sample portfolio data. It uses real user entries plus live public data:

- MFAPI/mfdata for Indian mutual fund search, NAV, and metadata where available
- Yahoo Finance chart/search endpoints for NSE/BSE stocks and India-listed ETFs

If a provider does not return data, the UI shows an unavailable state instead of fake fallback values.

## Scripts

```bash
npm run dev        # local app
npm run build      # production build
npm run lint       # eslint
npm run db:migrate # apply Prisma migrations
npm run db:seed    # no-op; no sample data is inserted
npm run db:studio  # open Prisma Studio
```
