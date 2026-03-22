# API Backend

Node.js + TypeScript + Fastify backend for TFT History Manager.

## Startup Lifecycle

The service starts in deterministic stages:

1. Ensure target database exists (`pg_database` existence check + conditional `CREATE DATABASE`)
2. Run Flyway migrations
3. Start HTTP server

If stage 1 or 2 fails, HTTP does not start.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- Flyway CLI available in PATH (or set `FLYWAY_COMMAND`)

## Environment

Copy root `.env.example` to `.env` and adjust values.

Important variables:

- `DB_BOOTSTRAP_ENABLED=true|false`
- `FLYWAY_ENABLED=true|false`
- `FLYWAY_COMMAND=flyway`
- `FLYWAY_LOCATIONS=filesystem:<absolute-path>` (optional)

## Commands

From repository root:

- `npm install --prefix apps/api`
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run lint`

Or from `apps/api`:

- `npm install`
- `npm run dev`

## Flyway Conventions

- Migration files are forward-only.
- Naming format: `V<version>__<description>.sql`
- Current baseline:
  - `V1__init_schema.sql`
  - `V2__seed_default_rule_sets.sql`
  - `V3__add_indexes.sql`
- Production schema/state is managed by Flyway only.
- ORM auto-sync/auto-create is not used.

## Seed/Demo Verification Checklist

After first startup:

1. `GET /api/v1/health` returns `success=true`.
2. `GET /api/v1/players` returns 4 demo players.
3. `GET /api/v1/rule-sets/default/by-module/MATCH_STAKES` returns default rule set.
4. `GET /api/v1/rule-sets/default/by-module/GROUP_FUND` returns default rule set.
5. `POST /api/v1/matches` works with:
   - 3-player Match Stakes
   - 4-player Match Stakes
   - 3-player Group Fund
6. `POST /api/v1/matches/:matchId/void` marks match voided and creates reversal ledger batch.
