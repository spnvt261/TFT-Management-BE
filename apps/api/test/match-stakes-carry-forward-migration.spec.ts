import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V8 match-stakes carry-forward + period-match-no migration", () => {
  it("adds init balances table, period closing snapshot columns, period_match_no, and backfill", () => {
    const sql = readFileSync(resolve(process.cwd(), "db/migrations/V8__add_match_stakes_carry_forward_and_period_match_no.sql"), "utf8");

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS close_note TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS closing_snapshot_json JSONB");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS next_period_id UUID");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS match_stakes_debt_period_init_balances");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS period_match_no INTEGER");
    expect(sql).toContain("ROW_NUMBER() OVER");
    expect(sql).toContain("PARTITION BY m.debt_period_id");
    expect(sql).toContain("WHERE m.module = 'MATCH_STAKES'");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS ux_matches_debt_period_period_match_no");
  });
});
