import { describe, expect, it, vi } from "vitest";
import { PresetRepository } from "../src/db/repositories/preset-repository.js";

describe("preset repository", () => {
  it("upsert stringifies lastSelectedPlayerIds for jsonb column", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PresetRepository({ query } as any);

    await repository.upsert({
      groupId: "group-1",
      module: "MATCH_STAKES",
      lastRuleSetId: "rule-set-1",
      lastRuleSetVersionId: "rule-version-1",
      lastSelectedPlayerIds: ["player-1", "player-2"],
      lastParticipantCount: 3,
      lastUsedAt: "2026-03-24T00:00:00.000Z"
    });

    const params = query.mock.calls[0]?.[1] as unknown[] | undefined;
    expect(typeof params?.[4]).toBe("string");
    expect(params?.[4]).toBe("[\"player-1\",\"player-2\"]");
  });

  it("getByModule supports jsonb returned as array", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          last_rule_set_id: "rule-set-1",
          last_rule_set_version_id: "rule-version-1",
          last_selected_player_ids_json: ["player-1", "player-2"],
          last_participant_count: 3,
          last_used_at: "2026-03-24T00:00:00.000Z"
        }
      ]
    });

    const repository = new PresetRepository({ query } as any);
    const result = await repository.getByModule("group-1", "MATCH_STAKES");

    expect(result.lastSelectedPlayerIds).toEqual(["player-1", "player-2"]);
  });

  it("getByModule supports jsonb returned as string", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          last_rule_set_id: "rule-set-1",
          last_rule_set_version_id: "rule-version-1",
          last_selected_player_ids_json: "[\"player-1\",\"player-2\"]",
          last_participant_count: 3,
          last_used_at: "2026-03-24T00:00:00.000Z"
        }
      ]
    });

    const repository = new PresetRepository({ query } as any);
    const result = await repository.getByModule("group-1", "MATCH_STAKES");

    expect(result.lastSelectedPlayerIds).toEqual(["player-1", "player-2"]);
  });
});
