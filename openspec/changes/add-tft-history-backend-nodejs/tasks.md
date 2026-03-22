## 1. Backend Foundation

- [x] 1.1 Scaffold backend root (`apps/api` or `backend`) with TypeScript, Fastify, lint, test, and build scripts
- [x] 1.2 Create shared layers (`src/core`, `src/db`, `src/domain`, `src/lib`) and module folders (`system`, `players`, `rules`, `matches`, `match-stakes`, `group-fund`, `presets`, `ledger`)
- [x] 1.3 Add environment config loader for app, PostgreSQL admin connection, target DB connection, and Flyway settings
- [x] 1.4 Implement common API response envelope and error mapping middleware

## 2. Startup Lifecycle: Bootstrap -> Flyway -> HTTP

- [x] 2.1 Implement database bootstrap service that connects to admin DB and checks `pg_database` for target DB existence
- [x] 2.2 Implement conditional `CREATE DATABASE` flow with idempotent/race-safe handling
- [x] 2.3 Implement Flyway runner service to execute migrations against the target database
- [x] 2.4 Wire startup orchestrator to run bootstrap, then Flyway, then HTTP server startup
- [x] 2.5 Add startup logging and failure behavior so HTTP never starts when bootstrap/migration fails

## 3. Flyway Migrations and Seed Baseline

- [x] 3.1 Create `V1__init_schema.sql` for core entities (group, players, members, rules, matches, settlements, ledgers, presets, audit)
- [x] 3.2 Create `V2__seed_default_rule_sets.sql` for default group, demo players, accounts, and MVP default rule sets/versions
- [x] 3.3 Create `V3__add_indexes.sql` for query paths used by match history, summaries, and ledger endpoints
- [x] 3.4 Add migration conventions doc (version naming, forward-only policy, no ORM auto-sync)

## 4. Core Infrastructure and Repositories

- [x] 4.1 Implement PostgreSQL pool, transaction helper, and repository base utilities
- [x] 4.2 Implement repositories for players, rule sets/versions/rules, matches/participants/notes, settlements, ledgers, presets
- [x] 4.3 Implement account resolution helpers for explicit source/destination selector mapping
- [x] 4.4 Add repository integration smoke tests for transaction boundaries and rollback behavior

## 5. System, Player, and Preset APIs

- [x] 5.1 Implement `GET /api/v1/health`
- [x] 5.2 Implement player APIs (`GET/POST/GET by id/PATCH/DELETE soft`) with typed DTO schemas
- [x] 5.3 Implement recent preset APIs (`GET` and `PUT` by module) with module-specific storage semantics
- [x] 5.4 Add validation and API contract tests for system/player/preset endpoints

## 6. Rule Set and Version APIs

- [x] 6.1 Implement rule set APIs (`GET/POST/GET by id/PATCH`) with module and default constraints
- [x] 6.2 Implement version APIs (`POST/GET/PATCH`) to persist rules, conditions, and actions per version
- [x] 6.3 Implement `GET /api/v1/rule-sets/default/by-module/:module` with active version resolution
- [x] 6.4 Add validation tests for participant-count range, effective window, and rule action selector integrity

## 7. Match Creation and Settlement Pipeline

- [x] 7.1 Implement `POST /api/v1/matches` DTO validation (3 or 4 players, unique player IDs, unique placements 1..8)
- [x] 7.2 Implement domain rule-engine pipeline (load rules, evaluate base rules, evaluate modifier/fund rules, generate settlement lines)
- [x] 7.3 Implement ledger posting service to convert settlement lines into ledger batch + entries
- [x] 7.4 Persist match, participants, note, snapshots, settlement header/lines, ledger posting, and preset update in one transaction
- [x] 7.5 Implement `GET /api/v1/matches` and `GET /api/v1/matches/:matchId` with settlement breakdown and rule version references

## 8. Match Stakes and Group Fund Read APIs

- [x] 8.1 Implement `GET /api/v1/match-stakes/summary`
- [x] 8.2 Implement `GET /api/v1/match-stakes/ledger` and `GET /api/v1/match-stakes/matches`
- [x] 8.3 Implement `GET /api/v1/group-fund/summary`
- [x] 8.4 Implement `GET /api/v1/group-fund/ledger` and `GET /api/v1/group-fund/matches`
- [x] 8.5 Add filter/pagination tests for summary/history endpoints

## 9. Match Void and Accounting Safety

- [x] 9.1 Implement `POST /api/v1/matches/:matchId/void` with domain validation and reason capture
- [x] 9.2 Implement reversal ledger batch strategy for voided posted matches
- [x] 9.3 Prevent destructive accounting deletes and add regression tests for historical integrity

## 10. Quality, Demo Data, and Local DX

- [x] 10.1 Add unit tests for default Match Stakes rules (3-player, 4-player, top1-top2 penalty, top8 penalty)
- [x] 10.2 Add unit tests for default Group Fund contribution rules and selector resolution behavior
- [x] 10.3 Add startup tests for DB-missing bootstrap, DB-existing no-op, and migration-failure stop behavior
- [x] 10.4 Add local run guide covering startup flow (`ensure DB exists -> run Flyway -> start HTTP`)
- [x] 10.5 Add seed/demo verification checklist for quick manual MVP validation
