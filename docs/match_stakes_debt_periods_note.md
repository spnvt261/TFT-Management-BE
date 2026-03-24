# Match Stakes Debt-Period Update

## What changed

- MATCH_STAKES now uses debt periods as the primary business flow.
- Each group has at most one `OPEN` debt period at a time.
- New MATCH_STAKES matches are auto-attached to the current open debt period.
- If no open debt period exists, match creation auto-creates one.
- Debt settlement payments are now tracked explicitly (separate from per-match settlement lines).
- Debt periods can only be closed when every player's `outstandingNetVnd` is exactly `0`.
- GROUP_FUND flow is unchanged.

## New database migration

- Added `V7__add_match_stakes_debt_periods.sql`.
- Adds enum `debt_period_status` (`OPEN`, `CLOSED`).
- Adds tables:
  - `match_stakes_debt_periods`
  - `match_stakes_debt_settlements`
  - `match_stakes_debt_settlement_lines`
- Adds `matches.debt_period_id` (nullable; used for MATCH_STAKES, remains null for GROUP_FUND).
- Adds unique open-period guard (`ux_match_stakes_debt_periods_one_open_per_group`).
- Backfills existing MATCH_STAKES data:
  - creates one open period per group with existing MATCH_STAKES matches,
  - assigns existing MATCH_STAKES matches with null `debt_period_id` into that period.

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
  - returns `debtPeriodId` and `debtPeriodNo` per item.
- `GET /api/v1/matches/:matchId`:
  - includes `debtPeriodId` and `debtPeriodNo` for MATCH_STAKES matches.
- `GET /api/v1/match-stakes/ledger` remains available for audit/legacy ledger view.
