DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'history_event_type') THEN
    CREATE TYPE history_event_type AS ENUM (
      'MATCH_STAKES_ADVANCE',
      'MATCH_STAKES_NOTE',
      'GROUP_FUND_ADVANCE',
      'GROUP_FUND_NOTE',
      'GROUP_FUND_ADJUSTMENT',
      'GROUP_FUND_CONTRIBUTION'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_stakes_impact_mode') THEN
    CREATE TYPE match_stakes_impact_mode AS ENUM ('INFORMATIONAL', 'AFFECTS_DEBT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS module_history_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  module module_type NOT NULL,
  event_type history_event_type NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NULL,
  amount_vnd BIGINT NULL,
  match_stakes_impact_mode match_stakes_impact_mode NULL,
  affects_debt BOOLEAN NOT NULL DEFAULT FALSE,
  player_id UUID NULL REFERENCES players(id),
  secondary_player_id UUID NULL REFERENCES players(id),
  debt_period_id UUID NULL REFERENCES match_stakes_debt_periods(id),
  match_id UUID NULL REFERENCES matches(id),
  ledger_batch_id UUID NULL REFERENCES ledger_entry_batches(id),
  balance_before_vnd BIGINT NULL,
  balance_after_vnd BIGINT NULL,
  outstanding_before_vnd BIGINT NULL,
  outstanding_after_vnd BIGINT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_role_code VARCHAR(30) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount_vnd IS NULL OR amount_vnd > 0),
  CHECK (
    (module = 'MATCH_STAKES' AND event_type IN ('MATCH_STAKES_ADVANCE', 'MATCH_STAKES_NOTE'))
    OR (
      module = 'GROUP_FUND'
      AND event_type IN ('GROUP_FUND_ADVANCE', 'GROUP_FUND_NOTE', 'GROUP_FUND_ADJUSTMENT', 'GROUP_FUND_CONTRIBUTION')
    )
  )
);

CREATE TABLE IF NOT EXISTS match_stakes_history_event_player_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_event_id UUID NOT NULL REFERENCES module_history_events(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id),
  debt_period_id UUID NOT NULL REFERENCES match_stakes_debt_periods(id),
  player_id UUID NOT NULL REFERENCES players(id),
  net_delta_vnd BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (history_event_id, player_id),
  CHECK (net_delta_vnd <> 0)
);

CREATE INDEX IF NOT EXISTS idx_module_history_events_group_module_posted
  ON module_history_events(group_id, module, posted_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_history_events_group_module_event_type
  ON module_history_events(group_id, module, event_type, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_history_events_player
  ON module_history_events(player_id, posted_at DESC)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_module_history_events_debt_period
  ON module_history_events(debt_period_id, posted_at DESC)
  WHERE debt_period_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_module_history_events_ledger_batch
  ON module_history_events(ledger_batch_id)
  WHERE ledger_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_match_stakes_history_impacts_period_player
  ON match_stakes_history_event_player_impacts(group_id, debt_period_id, player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_stakes_history_impacts_event
  ON match_stakes_history_event_player_impacts(history_event_id);
