DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_history_event_status') THEN
    CREATE TYPE module_history_event_status AS ENUM ('ACTIVE', 'RESET');
  END IF;
END $$;

ALTER TABLE module_history_events
  ADD COLUMN IF NOT EXISTS event_status module_history_event_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reset_reason TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_module_history_events_reset_state'
  ) THEN
    ALTER TABLE module_history_events
      ADD CONSTRAINT chk_module_history_events_reset_state
      CHECK (
        (event_status = 'ACTIVE' AND reset_at IS NULL AND reset_reason IS NULL)
        OR (event_status = 'RESET' AND reset_at IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_history_events_match_stakes_active_period
  ON module_history_events(group_id, debt_period_id, posted_at DESC, created_at DESC)
  WHERE module = 'MATCH_STAKES' AND event_status = 'ACTIVE' AND debt_period_id IS NOT NULL;
