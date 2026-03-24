DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_period_status') THEN
    CREATE TYPE debt_period_status AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS match_stakes_debt_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  period_no INTEGER NOT NULL,
  title VARCHAR(150) NULL,
  note TEXT NULL,
  status debt_period_status NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, period_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_match_stakes_debt_periods_one_open_per_group
  ON match_stakes_debt_periods(group_id)
  WHERE status = 'OPEN';

ALTER TABLE IF EXISTS matches
  ADD COLUMN IF NOT EXISTS debt_period_id UUID NULL REFERENCES match_stakes_debt_periods(id);

CREATE TABLE IF NOT EXISTS match_stakes_debt_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  debt_period_id UUID NOT NULL REFERENCES match_stakes_debt_periods(id),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_stakes_debt_settlement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES match_stakes_debt_settlements(id),
  debt_period_id UUID NOT NULL REFERENCES match_stakes_debt_periods(id),
  payer_player_id UUID NOT NULL REFERENCES players(id),
  receiver_player_id UUID NOT NULL REFERENCES players(id),
  amount_vnd BIGINT NOT NULL CHECK (amount_vnd > 0),
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payer_player_id <> receiver_player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_stakes_debt_periods_group_status_opened
  ON match_stakes_debt_periods(group_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_group_module_debt_period_played_at
  ON matches(group_id, module, debt_period_id, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_stakes_debt_settlements_period_posted_at
  ON match_stakes_debt_settlements(debt_period_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_stakes_debt_settlement_lines_period_players
  ON match_stakes_debt_settlement_lines(debt_period_id, payer_player_id, receiver_player_id, created_at DESC);

INSERT INTO match_stakes_debt_periods(group_id, period_no, title, note, status, opened_at, created_at, updated_at)
SELECT
  m.group_id,
  1,
  'Backfilled Period 1',
  'Auto-created by V7 migration for existing MATCH_STAKES matches',
  'OPEN',
  COALESCE(MIN(m.played_at), now()),
  now(),
  now()
FROM matches m
WHERE m.module = 'MATCH_STAKES'
GROUP BY m.group_id
ON CONFLICT (group_id, period_no) DO NOTHING;

UPDATE matches m
SET debt_period_id = p.id
FROM match_stakes_debt_periods p
WHERE m.module = 'MATCH_STAKES'
  AND m.debt_period_id IS NULL
  AND p.group_id = m.group_id
  AND p.status = 'OPEN';
