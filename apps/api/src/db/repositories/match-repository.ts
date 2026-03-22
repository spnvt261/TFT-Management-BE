import type { Queryable } from "../postgres/transaction.js";
import type { ModuleType, MatchStatus } from "../../domain/models/enums.js";

export interface MatchParticipantInsert {
  playerId: string;
  tftPlacement: number;
  relativeRank: number;
  isWinnerAmongParticipants: boolean;
  settlementNetVnd: number;
}

export interface MatchInsertInput {
  groupId: string;
  module: ModuleType;
  ruleSetId: string;
  ruleSetVersionId: string;
  playedAt: string;
  participantCount: number;
  status: MatchStatus;
  inputSnapshot: unknown;
  calculationSnapshot: unknown;
}

export interface MatchDetailRow {
  id: string;
  group_id: string;
  module: ModuleType;
  rule_set_id: string;
  rule_set_version_id: string;
  rule_set_version_no?: number;
  played_at: string;
  participant_count: number;
  status: MatchStatus;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchListFilters {
  groupId: string;
  module?: ModuleType;
  status?: MatchStatus;
  playerId?: string;
  ruleSetId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export class MatchRepository {
  public constructor(private readonly db: Queryable) {}

  public async createMatch(input: MatchInsertInput): Promise<{ id: string }> {
    const result = await this.db.query<{ id: string }>(
      `
      INSERT INTO matches(
        group_id, module, rule_set_id, rule_set_version_id, played_at, participant_count,
        status, input_snapshot_json, calculation_snapshot_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
      `,
      [
        input.groupId,
        input.module,
        input.ruleSetId,
        input.ruleSetVersionId,
        input.playedAt,
        input.participantCount,
        input.status,
        input.inputSnapshot,
        input.calculationSnapshot
      ]
    );

    return { id: result.rows[0]!.id };
  }

  public async insertParticipants(matchId: string, participants: MatchParticipantInsert[]): Promise<void> {
    for (const participant of participants) {
      await this.db.query(
        `
        INSERT INTO match_participants(
          match_id, player_id, tft_placement, relative_rank, is_winner_among_participants, settlement_net_vnd
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          matchId,
          participant.playerId,
          participant.tftPlacement,
          participant.relativeRank,
          participant.isWinnerAmongParticipants,
          participant.settlementNetVnd
        ]
      );
    }
  }

  public async upsertNote(matchId: string, note: string): Promise<void> {
    await this.db.query(
      `
      INSERT INTO match_notes(match_id, note_text)
      VALUES ($1, $2)
      ON CONFLICT (match_id)
      DO UPDATE SET note_text = EXCLUDED.note_text, updated_at = now()
      `,
      [matchId, note]
    );
  }

  public async findById(groupId: string, matchId: string): Promise<MatchDetailRow | null> {
    const result = await this.db.query<MatchDetailRow>(
      `
      SELECT id, group_id, module, rule_set_id, rule_set_version_id, played_at, participant_count, status,
             void_reason, voided_at, created_at, updated_at
      FROM matches
      WHERE id = $1 AND group_id = $2
      LIMIT 1
      `,
      [matchId, groupId]
    );

    return result.rows[0] ?? null;
  }

  public async list(filters: MatchListFilters): Promise<{ items: MatchDetailRow[]; total: number }> {
    const conditions: string[] = ["m.group_id = $1"];
    const params: unknown[] = [filters.groupId];

    if (filters.module) {
      params.push(filters.module);
      conditions.push(`m.module = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`m.status = $${params.length}`);
    }

    if (filters.playerId) {
      params.push(filters.playerId);
      conditions.push(`EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.match_id = m.id AND mp2.player_id = $${params.length})`);
    }

    if (filters.ruleSetId) {
      params.push(filters.ruleSetId);
      conditions.push(`m.rule_set_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      conditions.push(`m.played_at >= $${params.length}`);
    }

    if (filters.to) {
      params.push(filters.to);
      conditions.push(`m.played_at <= $${params.length}`);
    }

    const whereSql = conditions.join(" AND ");

    const totalResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM matches m WHERE ${whereSql}`,
      params
    );

    params.push(filters.pageSize, (filters.page - 1) * filters.pageSize);

    const result = await this.db.query<MatchDetailRow>(
      `
      SELECT m.id, m.group_id, m.module, m.rule_set_id, m.rule_set_version_id, rsv.version_no AS rule_set_version_no,
             m.played_at, m.participant_count, m.status, m.void_reason, m.voided_at, m.created_at, m.updated_at
      FROM matches m
      INNER JOIN rule_set_versions rsv ON rsv.id = m.rule_set_version_id
      WHERE ${whereSql}
      ORDER BY m.played_at DESC, m.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: result.rows,
      total: Number(totalResult.rows[0]?.count ?? "0")
    };
  }

  public async getParticipants(matchId: string): Promise<
    Array<{
      playerId: string;
      playerName: string;
      tftPlacement: number;
      relativeRank: number;
      isWinnerAmongParticipants: boolean;
      settlementNetVnd: number;
    }>
  > {
    const result = await this.db.query<{
      player_id: string;
      player_name: string;
      tft_placement: number;
      relative_rank: number;
      is_winner_among_participants: boolean;
      settlement_net_vnd: number;
    }>(
      `
      SELECT mp.player_id, p.display_name AS player_name, mp.tft_placement, mp.relative_rank,
             mp.is_winner_among_participants, mp.settlement_net_vnd
      FROM match_participants mp
      INNER JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = $1
      ORDER BY mp.relative_rank ASC
      `,
      [matchId]
    );

    return result.rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      tftPlacement: row.tft_placement,
      relativeRank: row.relative_rank,
      isWinnerAmongParticipants: row.is_winner_among_participants,
      settlementNetVnd: row.settlement_net_vnd
    }));
  }

  public async getNote(matchId: string): Promise<string | null> {
    const result = await this.db.query<{ note_text: string }>(`SELECT note_text FROM match_notes WHERE match_id = $1 LIMIT 1`, [matchId]);
    return result.rows[0]?.note_text ?? null;
  }

  public async voidMatch(matchId: string, reason: string): Promise<void> {
    await this.db.query(
      `
      UPDATE matches
      SET status = 'VOIDED', void_reason = $2, voided_at = now(), updated_at = now()
      WHERE id = $1
      `,
      [matchId, reason]
    );
  }
}
