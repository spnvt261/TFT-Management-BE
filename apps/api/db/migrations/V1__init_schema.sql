CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_type') THEN
    CREATE TYPE module_type AS ENUM ('MATCH_STAKES', 'GROUP_FUND');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM ('DRAFT', 'CALCULATED', 'POSTED', 'VOIDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_status') THEN
    CREATE TYPE rule_status AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_kind') THEN
    CREATE TYPE rule_kind AS ENUM (
      'BASE_RELATIVE_RANK',
      'ABSOLUTE_PLACEMENT_MODIFIER',
      'PAIR_CONDITION_MODIFIER',
      'FUND_CONTRIBUTION',
      'CUSTOM'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_operator') THEN
    CREATE TYPE condition_operator AS ENUM ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', 'BETWEEN', 'CONTAINS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_type') THEN
    CREATE TYPE action_type AS ENUM ('TRANSFER', 'POST_TO_FUND', 'CREATE_OBLIGATION', 'REDUCE_OBLIGATION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'selector_type') THEN
    CREATE TYPE selector_type AS ENUM (
      'SUBJECT_PLAYER',
      'PLAYER_BY_RELATIVE_RANK',
      'PLAYER_BY_ABSOLUTE_PLACEMENT',
      'MATCH_WINNER',
      'MATCH_RUNNER_UP',
      'BEST_PARTICIPANT',
      'WORST_PARTICIPANT',
      'FUND_ACCOUNT',
      'SYSTEM_ACCOUNT',
      'FIXED_PLAYER'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('PLAYER_DEBT', 'FUND_MAIN', 'PLAYER_FUND_OBLIGATION', 'SYSTEM_HOLDING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_source_type') THEN
    CREATE TYPE ledger_source_type AS ENUM ('MATCH_SETTLEMENT', 'MANUAL_ADJUSTMENT', 'SYSTEM_CORRECTION', 'MATCH_VOID_REVERSAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  currency_code VARCHAR(10) NOT NULL DEFAULT 'VND',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) UNIQUE NULL,
  avatar_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  player_id UUID NOT NULL REFERENCES players(id),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (group_id, player_id)
);

CREATE TABLE IF NOT EXISTS rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  module module_type NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status rule_status NOT NULL DEFAULT 'ACTIVE',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, code)
);

CREATE TABLE IF NOT EXISTS rule_set_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES rule_sets(id),
  version_no INTEGER NOT NULL,
  participant_count_min SMALLINT NOT NULL,
  participant_count_max SMALLINT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  summary_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_set_id, version_no),
  CHECK (participant_count_min <= participant_count_max)
);

CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_version_id UUID NOT NULL REFERENCES rule_set_versions(id),
  code VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  rule_kind rule_kind NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status rule_status NOT NULL DEFAULT 'ACTIVE',
  stop_processing_on_match BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_set_version_id, code)
);

CREATE TABLE IF NOT EXISTS rule_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES rules(id),
  condition_key VARCHAR(100) NOT NULL,
  operator condition_operator NOT NULL,
  value_json JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES rules(id),
  action_type action_type NOT NULL,
  amount_vnd BIGINT NOT NULL,
  source_selector_type selector_type NOT NULL,
  source_selector_json JSONB NULL,
  destination_selector_type selector_type NOT NULL,
  destination_selector_json JSONB NULL,
  description_template TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount_vnd >= 0)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  module module_type NOT NULL,
  rule_set_id UUID NOT NULL REFERENCES rule_sets(id),
  rule_set_version_id UUID NOT NULL REFERENCES rule_set_versions(id),
  played_at TIMESTAMPTZ NOT NULL,
  participant_count SMALLINT NOT NULL,
  status match_status NOT NULL DEFAULT 'POSTED',
  void_reason TEXT NULL,
  voided_at TIMESTAMPTZ NULL,
  input_snapshot_json JSONB NOT NULL,
  calculation_snapshot_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (participant_count IN (3, 4))
);

CREATE TABLE IF NOT EXISTS match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  player_id UUID NOT NULL REFERENCES players(id),
  seat_no SMALLINT NULL,
  tft_placement SMALLINT NOT NULL,
  relative_rank SMALLINT NOT NULL,
  is_winner_among_participants BOOLEAN NOT NULL DEFAULT FALSE,
  settlement_net_vnd BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id),
  UNIQUE (match_id, tft_placement),
  CHECK (tft_placement BETWEEN 1 AND 8),
  CHECK (relative_rank >= 1)
);

CREATE TABLE IF NOT EXISTS match_notes (
  match_id UUID PRIMARY KEY REFERENCES matches(id),
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  account_type account_type NOT NULL,
  player_id UUID NULL REFERENCES players(id),
  name VARCHAR(150) NOT NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'VND',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, account_type, player_id)
);

CREATE TABLE IF NOT EXISTS match_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES matches(id),
  module module_type NOT NULL,
  total_transfer_vnd BIGINT NOT NULL DEFAULT 0,
  total_fund_in_vnd BIGINT NOT NULL DEFAULT 0,
  total_fund_out_vnd BIGINT NOT NULL DEFAULT 0,
  engine_version VARCHAR(50) NOT NULL,
  rule_snapshot_json JSONB NOT NULL,
  result_snapshot_json JSONB NOT NULL,
  posted_to_ledger_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_settlement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_settlement_id UUID NOT NULL REFERENCES match_settlements(id),
  match_id UUID NOT NULL REFERENCES matches(id),
  line_no INTEGER NOT NULL,
  rule_id UUID NULL REFERENCES rules(id),
  rule_code VARCHAR(100) NOT NULL,
  rule_name VARCHAR(150) NOT NULL,
  source_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  destination_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  source_player_id UUID NULL REFERENCES players(id),
  destination_player_id UUID NULL REFERENCES players(id),
  amount_vnd BIGINT NOT NULL,
  reason_text TEXT NOT NULL,
  metadata_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_settlement_id, line_no),
  CHECK (amount_vnd > 0)
);

CREATE TABLE IF NOT EXISTS ledger_entry_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  module module_type NOT NULL,
  source_type ledger_source_type NOT NULL,
  match_id UUID NULL REFERENCES matches(id),
  reference_code VARCHAR(100) NULL,
  description TEXT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES ledger_entry_batches(id),
  match_settlement_line_id UUID NULL REFERENCES match_settlement_lines(id),
  source_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  destination_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  amount_vnd BIGINT NOT NULL,
  entry_reason TEXT NOT NULL,
  entry_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount_vnd > 0)
);

CREATE TABLE IF NOT EXISTS recent_match_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  module module_type NOT NULL,
  last_rule_set_id UUID NULL REFERENCES rule_sets(id),
  last_rule_set_version_id UUID NULL REFERENCES rule_set_versions(id),
  last_selected_player_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_participant_count SMALLINT NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, module)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NULL REFERENCES groups(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  before_json JSONB NULL,
  after_json JSONB NULL,
  metadata_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
