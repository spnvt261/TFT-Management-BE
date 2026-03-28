import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V11 match-stakes history reset status migration", () => {
  it("adds reset status columns and indexes for module_history_events", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "db/migrations/V11__add_match_stakes_history_event_reset_status.sql"),
      "utf8"
    );

    expect(sql).toContain("CREATE TYPE module_history_event_status AS ENUM ('ACTIVE', 'RESET')");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS event_status module_history_event_status NOT NULL DEFAULT 'ACTIVE'");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ NULL");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS reset_reason TEXT NULL");
    expect(sql).toContain("chk_module_history_events_reset_state");
    expect(sql).toContain("idx_module_history_events_match_stakes_active_period");
  });
});
