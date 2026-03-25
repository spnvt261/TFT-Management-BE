# Match Stakes Debt-Period Update

## What changed

- MATCH_STAKES now uses debt periods as the primary business flow.
- Each group has at most one `OPEN` debt period at a time.
- New MATCH_STAKES matches are auto-attached to the current open debt period.
- If no open debt period exists, match creation auto-creates one.
- Debt settlement payments are now tracked explicitly (separate from per-match settlement lines).
- Closing a debt period now accepts FE-submitted final balances (after external/offline settlements).
- Closing snapshot is persisted and linked to an auto-created next open period.
- Submitted final balances are carried forward as the next period's initial debt.
- Debt-period outstanding summary now includes init balances:
  - `outstandingNetVnd = initNetVnd + accruedNetVnd - settledReceivedVnd + settledPaidVnd`
- GROUP_FUND flow is unchanged.

## New database migration

- Added `V7__add_match_stakes_debt_periods.sql`.
- Added `V8__add_match_stakes_carry_forward_and_period_match_no.sql`.
- Adds enum `debt_period_status` (`OPEN`, `CLOSED`).
- Adds tables:
  - `match_stakes_debt_periods`
  - `match_stakes_debt_settlements`
  - `match_stakes_debt_settlement_lines`
- Adds `matches.debt_period_id` (nullable; used for MATCH_STAKES, remains null for GROUP_FUND).
- Adds `matches.period_match_no` (MATCH_STAKES period-local sequence, GROUP_FUND remains null).
- Adds `match_stakes_debt_period_init_balances` for per-period carried-forward initial debt.
- Extends `match_stakes_debt_periods` with:
  - `close_note`
  - `closing_snapshot_json`
  - `next_period_id`
- Adds unique open-period guard (`ux_match_stakes_debt_periods_one_open_per_group`).
- Backfills existing MATCH_STAKES data:
  - creates one open period per group with existing MATCH_STAKES matches,
  - assigns existing MATCH_STAKES matches with null `debt_period_id` into that period,
  - assigns stable `period_match_no` inside each debt period ordered by `played_at`, `created_at`, `id`.

## New APIs

- `GET /api/v1/match-stakes/debt-periods/current`
- `GET /api/v1/match-stakes/debt-periods`
- `GET /api/v1/match-stakes/debt-periods/:periodId`
- `GET /api/v1/match-stakes/debt-periods/:periodId/timeline`
- `POST /api/v1/match-stakes/debt-periods`
- `POST /api/v1/match-stakes/debt-periods/:periodId/settlements`
- `POST /api/v1/match-stakes/debt-periods/:periodId/close`

## Existing APIs updated

- `GET /api/v1/match-stakes/matches`:
  - supports `periodId` query filter,
  - returns `debtPeriodId`, `debtPeriodNo`, and `periodMatchNo` per item.
- `GET /api/v1/matches/:matchId`:
  - includes `debtPeriodId`, `debtPeriodNo`, and `periodMatchNo` for MATCH_STAKES matches.
- `POST /api/v1/matches`:
  - returns `periodMatchNo` for MATCH_STAKES.
- `GET /api/v1/match-stakes/ledger` remains available for audit/legacy ledger view.

## Close API contract change

- `POST /api/v1/match-stakes/debt-periods/:periodId/close`
  - request now requires `closingBalances: Array<{ playerId, netVnd }>` (unique player ids, net sum must be zero),
  - response now includes:
    - closed period status,
    - `nextPeriod` (auto-created `OPEN` period),
    - `carryForwardBalances` (normalized balances applied as next period init debt).
