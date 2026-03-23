import type { Queryable } from "../postgres/transaction.js";
import type { ModuleType } from "../../domain/models/enums.js";

export class PresetRepository {
  public constructor(private readonly db: Queryable) {}

  public async getByModule(groupId: string, module: ModuleType): Promise<{
    module: ModuleType;
    lastRuleSetId: string | null;
    lastRuleSetVersionId: string | null;
    lastSelectedPlayerIds: string[];
    lastParticipantCount: number | null;
    lastUsedAt: string | null;
  }> {
    const result = await this.db.query<{
      last_rule_set_id: string | null;
      last_rule_set_version_id: string | null;
      last_selected_player_ids_json: string[];
      last_participant_count: number | null;
      last_used_at: string | null;
    }>(
      `
      SELECT last_rule_set_id, last_rule_set_version_id, last_selected_player_ids_json,
             last_participant_count, last_used_at
      FROM recent_match_presets
      WHERE group_id = $1 AND module = $2
      LIMIT 1
      `,
      [groupId, module]
    );

    const row = result.rows[0];
    const rawLastSelected = row?.last_selected_player_ids_json;
    let lastSelectedPlayerIds: string[] = [];
    if (Array.isArray(rawLastSelected)) {
      lastSelectedPlayerIds = rawLastSelected;
    } else if (typeof rawLastSelected === "string") {
      try {
        const parsed = JSON.parse(rawLastSelected) as unknown;
        if (Array.isArray(parsed)) {
          lastSelectedPlayerIds = parsed.filter((item): item is string => typeof item === "string");
        }
      } catch {
        lastSelectedPlayerIds = [];
      }
    }

    return {
      module,
      lastRuleSetId: row?.last_rule_set_id ?? null,
      lastRuleSetVersionId: row?.last_rule_set_version_id ?? null,
      lastSelectedPlayerIds,
      lastParticipantCount: row?.last_participant_count ?? null,
      lastUsedAt: row?.last_used_at ?? null
    };
  }

  public async upsert(input: {
    groupId: string;
    module: ModuleType;
    lastRuleSetId: string | null;
    lastRuleSetVersionId: string | null;
    lastSelectedPlayerIds: string[];
    lastParticipantCount: number;
    lastUsedAt?: string;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO recent_match_presets(
        group_id, module, last_rule_set_id, last_rule_set_version_id,
        last_selected_player_ids_json, last_participant_count, last_used_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
      ON CONFLICT (group_id, module)
      DO UPDATE SET
        last_rule_set_id = EXCLUDED.last_rule_set_id,
        last_rule_set_version_id = EXCLUDED.last_rule_set_version_id,
        last_selected_player_ids_json = EXCLUDED.last_selected_player_ids_json,
        last_participant_count = EXCLUDED.last_participant_count,
        last_used_at = EXCLUDED.last_used_at,
        updated_at = now()
      `,
      [
        input.groupId,
        input.module,
        input.lastRuleSetId,
        input.lastRuleSetVersionId,
        JSON.stringify(input.lastSelectedPlayerIds),
        input.lastParticipantCount,
        input.lastUsedAt ?? null
      ]
    );
  }
}
