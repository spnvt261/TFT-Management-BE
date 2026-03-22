## ADDED Requirements

### Requirement: Startup lifecycle MUST execute in deterministic stages
The backend SHALL execute startup in three ordered stages: database bootstrap, migration execution, and HTTP server startup. The backend MUST NOT accept HTTP requests before bootstrap and migrations complete successfully.

#### Scenario: Target database does not exist at startup
- **WHEN** the backend starts and the target PostgreSQL database is absent
- **THEN** the system performs database bootstrap first, runs Flyway migrations second, and starts the HTTP server third

#### Scenario: Migration fails during startup
- **WHEN** Flyway migration execution returns an error
- **THEN** the backend startup fails and the HTTP server is not started

### Requirement: Database bootstrap MUST be existence-check + conditional create
The backend SHALL connect to an admin/system PostgreSQL database (for example `postgres`) and query `pg_database` to determine whether the target application database exists. If the database does not exist, the backend SHALL create it before migration execution.

#### Scenario: Existing target database
- **WHEN** bootstrap checks `pg_database` and finds the target database
- **THEN** bootstrap completes without creating a new database and proceeds to migration stage

#### Scenario: Missing target database
- **WHEN** bootstrap checks `pg_database` and does not find the target database
- **THEN** bootstrap creates the target database and proceeds to migration stage

### Requirement: Bootstrap implementation MUST account for PostgreSQL semantics
The system MUST explicitly document and implement that PostgreSQL does not support a simple `CREATE DATABASE IF NOT EXISTS` statement for this workflow.

#### Scenario: Bootstrap implementation guidance
- **WHEN** maintainers review backend startup design and code
- **THEN** they can see that the implementation uses `pg_database` existence checking plus conditional `CREATE DATABASE` instead of `CREATE DATABASE IF NOT EXISTS`

### Requirement: Bootstrap and migration flow MUST be idempotent and safe
Repeated backend starts SHALL be safe in local/dev/self-hosted and production-like environments. Existing database and applied migration states MUST NOT cause destructive behavior.

#### Scenario: Repeated startup with existing DB and applied migrations
- **WHEN** the backend is restarted with an already existing database and up-to-date Flyway schema history
- **THEN** bootstrap is a no-op, Flyway reports no pending changes, and HTTP startup succeeds