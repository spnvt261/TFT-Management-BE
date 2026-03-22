ALTER TABLE IF EXISTS rule_set_versions
  ADD COLUMN IF NOT EXISTS builder_type VARCHAR(50) NULL;

ALTER TABLE IF EXISTS rule_set_versions
  ADD COLUMN IF NOT EXISTS builder_config_json JSONB NULL;
