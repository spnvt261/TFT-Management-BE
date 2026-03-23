ALTER TABLE IF EXISTS rule_set_versions
  ADD COLUMN IF NOT EXISTS description TEXT NULL;

UPDATE rule_set_versions v
SET description = rs.description
FROM rule_sets rs
WHERE v.rule_set_id = rs.id
  AND v.description IS NULL
  AND rs.description IS NOT NULL;
