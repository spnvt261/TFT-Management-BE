ALTER TABLE IF EXISTS match_stakes_debt_periods
  ADD COLUMN IF NOT EXISTS close_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS closing_snapshot_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS next_period_id UUID NULL REFERENCES match_stakes_debt_periods(id);

CREATE INDEX IF NOT EXISTS idx_match_stakes_debt_periods_next_period
  ON match_stakes_debt_periods(next_period_id)
  WHERE next_period_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS match_stakes_debt_period_init_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_period_id UUID NOT NULL REFERENCES match_stakes_debt_periods(id),
  player_id UUID NOT NULL REFERENCES players(id),
  init_net_vnd BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (debt_period_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_stakes_debt_period_init_balances_period
  ON match_stakes_debt_period_init_balances(debt_period_id);

ALTER TABLE IF EXISTS matches
  ADD COLUMN IF NOT EXISTS period_match_no INTEGER NULL;

ALTER TABLE IF EXISTS matches
  DROP CONSTRAINT IF EXISTS chk_matches_period_match_no_positive;

ALTER TABLE IF EXISTS matches
  ADD CONSTRAINT chk_matches_period_match_no_positive
    CHECK (period_match_no IS NULL OR period_match_no > 0);

WITH ranked AS (
  SELECT
    m.id,
    ROW_NUMBER() OVER (
      PARTITION BY m.debt_period_id
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
    )::int AS rn
  FROM matches m
  WHERE m.module = 'MATCH_STAKES'
    AND m.debt_period_id IS NOT NULL
)
UPDATE matches m
SET period_match_no = ranked.rn
FROM ranked
WHERE m.id = ranked.id
  AND m.period_match_no IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_matches_debt_period_period_match_no
  ON matches(debt_period_id, period_match_no)
  WHERE debt_period_id IS NOT NULL AND period_match_no IS NOT NULL;
