## Context

This change creates the first production-oriented backend for TFT History Manager with backend-first delivery as the priority. The backend must support rule-driven settlement calculation, double-entry-style ledger posting, and separate accounting views for `MATCH_STAKES` and `GROUP_FUND`.

Current constraints and requirements:
- Backend only (frontend is out of scope for this change).
- Runtime: Node.js + TypeScript.
- Database: PostgreSQL.
- Migration source of truth: Flyway versioned SQL files (no ORM auto schema sync in production).
- Startup must be idempotent and safe:
  1. Ensure target DB exists (create if missing).
  2. Run Flyway migrations.
  3. Start HTTP API.

Important PostgreSQL behavior:
- PostgreSQL does not provide a simple `CREATE DATABASE IF NOT EXISTS` statement.
- Therefore the backend must first query `pg_database` via an admin/system DB connection, then conditionally create the target DB.

This behavior is especially useful for local/dev and self-hosted deployments while remaining safe for production (existing DB path is a no-op).

## Goals / Non-Goals

**Goals:**
- Deliver a backend-only OpenSpec baseline with clear capability boundaries.
- Standardize a modular Node.js architecture with business logic in domain services, not route handlers.
- Define explicit startup lifecycle separation (bootstrap vs migration vs app startup).
- Define Flyway-first schema evolution and versioned SQL naming conventions (`V1__...`, `V2__...`, `V3__...`).
- Define typed REST APIs and explicit DTO validation for MVP flows.
- Define rule engine pipeline with rule/version snapshots and auditable settlement breakdown.
- Define ledger posting strategy and separate module-facing summaries/histories.
- Keep implementation simple enough for a side project while preserving maintainability.

**Non-Goals:**
- Frontend implementation (React/TypeScript is intentionally deferred).
- Full auth/RBAC design.
- Multi-tenant hard isolation beyond a single-group-first MVP model.
- Event-driven microservices or distributed architecture.
- Real-time streaming updates or websocket protocol.

## Decisions

### 1. Final backend stack
- Framework: Fastify (HTTP, lifecycle hooks, plugin model).
- Language/tooling: Node.js LTS + TypeScript.
- Validation: Zod schemas for request DTOs and response contracts.
- Database driver/access: PostgreSQL (`pg`) with repository pattern (optional lightweight query helper), without schema auto-sync.
- Migrations: Flyway CLI/container invocation from backend startup orchestration.
- Testing: Vitest + supertest/light-my-request for API, unit tests for domain services.

Rationale:
- Fastify + TypeScript yields strong structure and performance with low complexity.
- Zod enables explicit runtime validation and type inference.
- Direct SQL/repository control aligns with Flyway-managed schema and avoids ORM schema drift.

Alternatives considered:
- Express: viable but weaker built-in typing/plugin lifecycle than Fastify.
- Full ORM auto-migrate: rejected because schema source of truth must be Flyway SQL.

### 2. Backend project structure (backend-first)
Preferred structure (choose one root and keep consistent):

```text
apps/api/
  src/
    main.ts
    app.ts
    core/
      config/
      errors/
      logger/
      types/
    db/
      bootstrap/
        ensure-database.ts
      migrations/
        flyway-runner.ts
      postgres/
        pool.ts
        transaction.ts
      repositories/
    domain/
      services/
        rule-engine/
        settlement/
        ledger-posting/
      models/
      value-objects/
    lib/
      time/
      money/
      id/
    modules/
      system/
      players/
      rules/
      matches/
      match-stakes/
      group-fund/
      presets/
      ledger/
```

Module boundary rule:
- `modules/*`: controllers, DTO schemas, app services, repository orchestration.
- `domain/*`: pure business logic (rule evaluation, settlement generation, posting plans).
- `db/*`: infrastructure concerns (pooling, transactions, bootstrap, migration runner).
- Controllers remain thin: validate, call service, map response.

### 3. Startup lifecycle organization
Startup is split into explicit stages:

1. **Database bootstrap stage**
- Connect to admin DB (default `postgres`) using privileged credentials.
- Query existence:
  - `SELECT 1 FROM pg_database WHERE datname = $1`
- If absent, issue `CREATE DATABASE <target_name>` (escaped identifier).
- Handle race/idempotency:
  - if duplicate database error occurs during concurrent startup, continue.
- Close admin connection.

2. **Migration stage (Flyway)**
- Execute Flyway against target DB.
- Enforce versioned files under `db/migration/`:
  - `V1__init_schema.sql`
  - `V2__seed_default_rule_sets.sql`
  - `V3__add_indexes.sql`
- Fail startup if migration fails.

3. **Application stage**
- Initialize app dependencies and routes.
- Start HTTP server only after successful bootstrap + migration.

Rationale:
- Deterministic startup ordering avoids serving APIs against stale/missing schema.

### 4. Flyway schema strategy
- Flyway is the only production schema evolution mechanism.
- Migration scripts are immutable and append-only by version.
- New schema changes are added as new migration versions.
- No ORM `synchronize`/auto-create in production.
- Seed/default rule sets are managed by versioned SQL migration or repeatable seed scripts as needed.

### 5. API boundaries (MVP)
Base path: `/api/v1`

Required endpoint groups:
- `GET /health`
- Players CRUD-ish:
  - `GET /players`
  - `POST /players`
  - `GET /players/:playerId`
  - `PATCH /players/:playerId`
  - `DELETE /players/:playerId` (soft deactivate)
- Rule sets and versions:
  - `GET /rule-sets`
  - `POST /rule-sets`
  - `GET /rule-sets/:ruleSetId`
  - `PATCH /rule-sets/:ruleSetId`
  - `POST /rule-sets/:ruleSetId/versions`
  - `GET /rule-sets/:ruleSetId/versions/:versionId`
  - `PATCH /rule-sets/:ruleSetId/versions/:versionId`
  - `GET /rule-sets/default/by-module/:module`
- Matches:
  - `POST /matches`
  - `GET /matches`
  - `GET /matches/:matchId`
  - `POST /matches/:matchId/void`
- Match Stakes:
  - `GET /match-stakes/summary`
  - `GET /match-stakes/ledger`
  - `GET /match-stakes/matches`
- Group Fund:
  - `GET /group-fund/summary`
  - `GET /group-fund/ledger`
  - `GET /group-fund/matches`
- Recent preset:
  - `GET /recent-match-presets/:module`
  - `PUT /recent-match-presets/:module`

### 6. DTO + validation strategy
- Every request DTO has a Zod schema and inferred TS type.
- Validation is explicit per route with uniform error mapping.
- Money fields use integer constraints (`int`, non-float) with VND semantics.
- `CreateMatch` validation includes:
  - participants length is 3 or 4
  - unique player IDs
  - unique placements
  - placement in range 1..8
  - module-rule-set compatibility
- Domain-level validation re-checks invariant constraints before persistence.

### 7. Rule engine strategy
Centralized pipeline in domain services:
1. Load selected/effective `RuleSetVersion` and all active rules.
2. Build match context (module, participant count, absolute placement, relative ranks).
3. Evaluate base rules (participant-count/module driven payouts).
4. Evaluate modifier rules (top1-top2 penalty, top8 penalty, etc.).
5. Evaluate fund contribution rules.
6. Generate ordered settlement lines with rule references.
7. Resolve explicit source/destination accounts from rule actions.
8. Convert settlement lines to ledger entry plan.
9. Persist match, snapshots, settlements, settlement lines, ledger batch/entries in one transaction.

Key requirement:
- Penalty destination is never globally hard-coded.
- Each rule action explicitly defines source and destination selectors/accounts.

Default MVP assumptions captured in seeded rules:
- Top1-top2 penalty: top2 pays top1.
- Top8 penalty: placement 8 pays best participant in that match.

### 8. Ledger posting strategy
- Settlement output is separated from ledger posting persistence but committed atomically.
- `match_settlement_lines` preserve rule-by-rule explanation.
- `ledger_entries` store accounting movement history.
- Separate summary query services by module:
  - `MATCH_STAKES`: player-vs-player debt/profit-loss view.
  - `GROUP_FUND`: fund balance + player obligations to fund.
- Match void uses reversal posting strategy (no hard delete of accounting history).

### 9. Database schema strategy
Core entities supported:
- Group, Player, GroupMember
- Match, MatchParticipant, MatchNote
- RuleSet, RuleSetVersion, Rule, RuleCondition, RuleAction
- MatchSettlement, MatchSettlementLine
- LedgerAccount, LedgerEntryBatch, LedgerEntry
- RecentMatchPreset
- AuditLog

Storage rules:
- Monetary values as integer VND (`BIGINT`).
- Timestamps as timezone-aware (`TIMESTAMPTZ`).
- Match stores exact `rule_set_version_id` used for calculation.
- Settlement stores rule snapshot/result snapshot for auditability.

### 10. Seed strategy
- Seed one default group.
- Seed demo players.
- Seed ledger accounts for required account types.
- Seed default rule sets and versions:
  - Match Stakes (3-player and 4-player defaults)
  - Group Fund (3-player configurable X/Y example)
- Seed should be idempotent and safe in local/dev.

### 11. Testing strategy
- Unit tests: rule evaluation, settlement line generation, selector resolution, ledger plan generation.
- Integration tests: transactionally create match and verify persisted settlement + ledger entries.
- Contract tests: DTO validation errors, API status codes, response envelope consistency.
- Startup tests:
  - DB missing => bootstrap creates DB, then migrations run.
  - DB exists => bootstrap no-op, migrations still run safely.
  - migration failure => API does not start.

## Risks / Trade-offs

- **[Risk] Startup requires admin DB privilege to create database** -> Mitigation: make bootstrap togglable (`DB_BOOTSTRAP_ENABLED`), with clear docs for restricted production environments.
- **[Risk] Flyway invocation dependency across environments** -> Mitigation: provide standard run mode (local binary or container) and health logs during migration stage.
- **[Risk] Rule data model flexibility increases complexity** -> Mitigation: start with constrained selector/operator/action enums and add gradually via new migrations.
- **[Risk] Ledger reversal semantics for void can be subtle** -> Mitigation: define deterministic reversal batch strategy and test with snapshot assertions.
- **[Trade-off] Repository + SQL approach over full ORM convenience** -> Benefit: strict migration control and predictable SQL behavior; Cost: more manual query code.

## Migration Plan

1. Scaffold backend modules and startup orchestrator.
2. Add DB bootstrap component (`ensure-database`) using admin connection and `pg_database` existence check.
3. Add Flyway runner and baseline migrations (`V1`, `V2`, `V3`).
4. Implement core schema repositories and transactional helpers.
5. Implement rule set APIs and version APIs.
6. Implement match creation pipeline (calculate + persist + post ledger + preset update).
7. Implement summary/history APIs per module.
8. Implement void match reversal flow.
9. Add unit/integration/contract tests and seed scripts.
10. Validate end-to-end startup sequence in local and self-hosted modes.

Rollback strategy:
- Application rollback via deployment artifact rollback.
- Database rollback via forward-fix Flyway migration approach (preferred) or explicit down strategy in non-production environments only.

## Open Questions

- Should database bootstrap be enabled by default in all environments or only local/self-hosted profiles?
- Should `group_id` be fixed single-tenant MVP with one seeded group, or kept fully multi-group from day one?
- For Group Fund, should obligation tracking be immediate transfer-to-fund only for MVP, or include separate unpaid obligation state at launch?
- Should default rule seed values `X` and `Y` be environment-configurable or static initial values with admin-edit through rule APIs?