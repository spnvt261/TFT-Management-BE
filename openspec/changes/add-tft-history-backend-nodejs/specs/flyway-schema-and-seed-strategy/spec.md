## ADDED Requirements

### Requirement: Flyway MUST be the schema source of truth
Production schema creation and evolution SHALL be managed by Flyway versioned SQL migrations. The backend MUST NOT rely on ORM auto-sync/auto-create for production schema state.

#### Scenario: Production startup behavior
- **WHEN** the backend starts in production-like mode
- **THEN** schema changes are applied through Flyway migration execution, not ORM schema synchronization

### Requirement: Migration files MUST follow versioned naming conventions
Migration scripts SHALL follow versioned Flyway naming such as:
- `V1__init_schema.sql`
- `V2__seed_default_rule_sets.sql`
- `V3__add_indexes.sql`

#### Scenario: Add new schema change
- **WHEN** developers introduce a new schema update
- **THEN** they add a new higher-version Flyway SQL migration file following the naming convention

### Requirement: Initial schema migration MUST cover backend core entities
Baseline migrations SHALL create schema required for backend MVP capabilities including group/player, rule/version/rule-action model, match/settlement model, ledger model, presets, and audit entities.

#### Scenario: Fresh environment migration
- **WHEN** Flyway runs against an empty target database
- **THEN** all required core tables exist to support rule-driven match creation and ledger history endpoints

### Requirement: Seed strategy MUST support deterministic local/demo setup
Migration/seed flow SHALL provide deterministic default data for local/dev and demo usage, including default rule sets/versions and minimal sample group/player/account data.

#### Scenario: Local bootstrap on empty database
- **WHEN** a developer runs backend startup on an empty environment
- **THEN** migrations and seed steps produce runnable defaults without manual SQL intervention

### Requirement: Schema evolution MUST be forward-only and auditable
Schema evolution SHALL be append-only through new migration versions so historical migration history remains auditable and reproducible.

#### Scenario: Existing environment upgrade
- **WHEN** a deployment upgrades from older schema version
- **THEN** Flyway applies only pending migrations in order and preserves migration history metadata