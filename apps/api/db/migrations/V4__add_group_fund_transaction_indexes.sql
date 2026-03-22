CREATE INDEX IF NOT EXISTS idx_ledger_batches_group_module_source_posted_at
  ON ledger_entry_batches(group_id, module, source_type, posted_at DESC);
