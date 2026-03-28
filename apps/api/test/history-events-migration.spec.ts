import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V10 module history events migration", () => {
  it("creates history event enums, tables, and indexes", () => {
    const sql = readFileSync(resolve(process.cwd(), "db/migrations/V10__add_module_history_events.sql"), "utf8");

    expect(sql).toContain("CREATE TYPE history_event_type AS ENUM");
    expect(sql).toContain("CREATE TYPE match_stakes_impact_mode AS ENUM ('INFORMATIONAL', 'AFFECTS_DEBT')");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS module_history_events");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS match_stakes_history_event_player_impacts");
    expect(sql).toContain("MATCH_STAKES_ADVANCE");
    expect(sql).toContain("GROUP_FUND_ADVANCE");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_module_history_events_group_module_posted");
  });
});
