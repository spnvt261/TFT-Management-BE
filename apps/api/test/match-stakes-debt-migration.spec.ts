import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V7 match-stakes debt migration", () => {
  it("contains enum, tables, debt_period_id column, and backfill update", () => {
    const sql = readFileSync(resolve(process.cwd(), "db/migrations/V7__add_match_stakes_debt_periods.sql"), "utf8");

    expect(sql).toContain("CREATE TYPE debt_period_status AS ENUM ('OPEN', 'CLOSED')");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS match_stakes_debt_periods");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS match_stakes_debt_settlements");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS match_stakes_debt_settlement_lines");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS debt_period_id UUID");
    expect(sql).toContain("INSERT INTO match_stakes_debt_periods");
    expect(sql).toContain("WHERE m.module = 'MATCH_STAKES'");
    expect(sql).toContain("UPDATE matches m");
    expect(sql).toContain("SET debt_period_id = p.id");
  });
});
