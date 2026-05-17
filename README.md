# Restaurant Management System

Monorepo with:

- **`apps/web`** — Vite + React + TypeScript (guest menu at `/t/:tableSlug`, staff routes under `/staff`)
- **`apps/api`** — Express + TypeScript + MongoDB (Mongoose)

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

## Setup

```bash
cd restaurant-management-system
npm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set MONGODB_URI and at least 8-char secrets for GUEST_JWT_SECRET and STAFF_JWT_SECRET
```

## Run

Terminal 1 — API (port 4000):

```bash
npm run dev -w apps/api
```

Terminal 2 — Web (port 5173):

```bash
npm run dev -w apps/web
```

## Quick test data

With the API running, seed a demo table and menu:

```bash
npm run seed -w apps/api
```

Then open the guest menu:

`http://localhost:5173/t/<tableSlugPrintedBySeed>`

Default staff login after seed:

- **Email:** `admin@demo.local`
- **Password:** `admin123`

## Guest flow

1. QR opens `/t/{tableSlug}`.
2. Web calls `POST /api/guest/sessions` with `{ "tableSlug": "..." }` (credentials include).
3. API sets HttpOnly cookie `guest_token` and returns table + session info.
4. Menu and order use `GET/POST /api/guest/*` with that cookie.

## Docker (Mongo only)

```bash
docker compose -f docker/docker-compose.yml up -d
```

Use `MONGODB_URI=mongodb://127.0.0.1:27017/rms` in `apps/api/.env`.
