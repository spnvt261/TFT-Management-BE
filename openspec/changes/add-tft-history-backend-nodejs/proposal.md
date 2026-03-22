## Why

The TFT History Manager needs a backend-first foundation that can safely calculate match settlements, post ledger movements, and evolve rules without code rewrites. This change is needed now to unblock MVP delivery with production-safe database lifecycle management (bootstrap + migrations) and a clear Node.js service architecture.

## What Changes

- Introduce a backend-only architecture for `apps/api` (or `backend/`) using Node.js + TypeScript + PostgreSQL with REST JSON endpoints.
- Define modular boundaries for `players`, `rules`, `matches`, `match-stakes`, `group-fund`, `presets`, `ledger`, and `system`, plus shared `core`, `db`, `domain`, and `lib` layers.
- Define a startup lifecycle that is explicitly separated into:
  - database bootstrap (admin connection checks `pg_database`, creates target DB when missing)
  - Flyway migration execution against target DB
  - HTTP application startup
- Specify Flyway as the source of truth for schema evolution with versioned SQL migrations (`V1__...`, `V2__...`, `V3__...`) and explicitly prohibit ORM auto-sync for production schema creation.
- Define PostgreSQL bootstrap behavior as idempotent and safe for local/self-hosted use and no-op safe for production when DB already exists.
- Define strongly typed DTOs and explicit validation for MVP REST APIs: health, players, rule sets, rule set versions, matches, match detail, match void, module summaries/histories, and recent preset.
- Define rule engine and settlement pipeline in domain services (not controllers): load versioned rules, evaluate conditions, apply actions, generate settlement lines, generate ledger entries, persist snapshots.
- Define accounting separation between `MATCH_STAKES` and `GROUP_FUND`, including explicit source/destination accounts per rule action.
- Define persistence strategy for rule versioning, rule snapshots, settlement breakdowns, separate ledgers, recent preset, and audit records.
- Define seed/demo data requirements and test strategy for startup bootstrap, migrations, validation, settlement calculations, and ledger posting.

## Capabilities

### New Capabilities
- `backend-startup-and-db-lifecycle`: Backend startup SHALL ensure database existence, run Flyway migrations, and only then start serving HTTP.
- `backend-modular-architecture`: Backend codebase SHALL enforce modular layering with controller/service/domain separation and shared platform modules.
- `rule-set-and-version-management-api`: System SHALL expose typed APIs for rule sets and versioned rules with activation/effective-window control.
- `match-settlement-and-posting`: System SHALL create matches, calculate settlements immediately, persist snapshots, and support safe void workflow.
- `ledger-and-module-summary-queries`: System SHALL maintain separate accounting views for Match Stakes and Group Fund with summary and history APIs.
- `player-and-recent-preset-api`: System SHALL provide player management and recent match preset APIs for quick entry UX.
- `flyway-schema-and-seed-strategy`: Database schema changes and seed defaults SHALL be managed through Flyway versioned migrations.

### Modified Capabilities
- None.

## Impact

- Affects backend project structure, startup runtime flow, database operations, and all MVP API boundaries.
- Introduces operational dependency on Flyway CLI/runtime integration in local/dev/deploy environments.
- Establishes PostgreSQL as required runtime dependency and migration target.
- Requires new migration assets, seed SQL, integration tests, domain unit tests, and API contract tests.
- Provides clear implementation path for subsequent `/opsx:apply` with backend-first incremental tasks.