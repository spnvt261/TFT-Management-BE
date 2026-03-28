# Migration Policy

This project uses Flyway as the only schema source of truth.

## Rules

- Forward-only migrations.
- Immutable migration files once applied.
- New changes use a higher version file.
- Naming convention: `V<version>__<description>.sql`.
- Do not use ORM auto-sync/auto-create in production.

## Current Versions

- `V1__init_schema.sql`
- `V2__seed_default_rule_sets.sql`
- `V3__add_indexes.sql`
- `V4__add_group_fund_transaction_indexes.sql`
- `V5__add_rule_set_version_builder_columns.sql`
- `V6__add_rule_set_version_description.sql`
- `V7__add_match_stakes_debt_periods.sql`
- `V8__add_match_stakes_carry_forward_and_period_match_no.sql`
- `V9__add_roles_table.sql`
- `V10__add_module_history_events.sql`

## Operational Notes

- Bootstrap stage checks `pg_database` and creates target DB if missing.
- Migrations run after bootstrap and before HTTP server startup.
- Startup is idempotent: existing DB and up-to-date Flyway history are no-op safe.
