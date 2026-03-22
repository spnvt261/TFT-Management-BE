import type { Queryable } from "../postgres/transaction.js";
import type { LedgerEntryDraft } from "../../domain/models/records.js";
import type { ModuleType } from "../../domain/models/enums.js";

export type GroupFundTransactionType = "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export class LedgerRepository {
  public constructor(private readonly db: Queryable) {}

  public async createBatch(input: {
    groupId: string;
    module: ModuleType;
    sourceType: "MATCH_SETTLEMENT" | "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION" | "MATCH_VOID_REVERSAL";
    matchId: string | null;
    description: string;
    referenceCode: string | null;
    postedAt?: string | null;
  }): Promise<{ id: string }> {
    const result = await this.db.query<{ id: string }>(
      `
      INSERT INTO ledger_entry_batches(group_id, module, source_type, match_id, description, reference_code, posted_at)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
      RETURNING id
      `,
      [input.groupId, input.module, input.sourceType, input.matchId, input.description, input.referenceCode, input.postedAt ?? null]
    );

    return { id: result.rows[0]!.id };
  }

  public async insertEntries(batchId: string, matchSettlementLineIds: string[], entries: LedgerEntryDraft[]): Promise<void> {
    for (const entry of entries) {
      const settlementLineId = matchSettlementLineIds[entry.lineNo - 1] ?? null;

      await this.db.query(
        `
        INSERT INTO ledger_entries(
          batch_id, match_settlement_line_id, source_account_id, destination_account_id, amount_vnd, entry_reason, entry_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [batchId, settlementLineId, entry.sourceAccountId, entry.destinationAccountId, entry.amountVnd, entry.reasonText, entry.lineNo]
      );
    }
  }

  public async getInsertedSettlementLineIds(settlementId: string): Promise<string[]> {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM match_settlement_lines
      WHERE match_settlement_id = $1
      ORDER BY line_no ASC
      `,
      [settlementId]
    );

    return result.rows.map((row) => row.id);
  }

  public async getEntriesByMatch(matchId: string): Promise<
    Array<{
      id: string;
      sourceAccountId: string;
      destinationAccountId: string;
      amountVnd: number;
      reasonText: string;
      entryOrder: number;
      module: ModuleType;
      groupId: string;
    }>
  > {
    const result = await this.db.query<{
      id: string;
      source_account_id: string;
      destination_account_id: string;
      amount_vnd: number;
      entry_reason: string;
      entry_order: number;
      module: ModuleType;
      group_id: string;
    }>(
      `
      SELECT e.id, e.source_account_id, e.destination_account_id, e.amount_vnd, e.entry_reason, e.entry_order,
             b.module, b.group_id
      FROM ledger_entries e
      INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
      WHERE b.match_id = $1
      ORDER BY e.entry_order ASC
      `,
      [matchId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceAccountId: row.source_account_id,
      destinationAccountId: row.destination_account_id,
      amountVnd: row.amount_vnd,
      reasonText: row.entry_reason,
      entryOrder: row.entry_order,
      module: row.module,
      groupId: row.group_id
    }));
  }

  public async listLedgerByModule(input: {
    groupId: string;
    module: ModuleType;
    playerId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: any[]; total: number }> {
    const conditions = ["b.group_id = $1", "b.module = $2"];
    const params: unknown[] = [input.groupId, input.module];

    if (input.from) {
      params.push(input.from);
      conditions.push(`b.posted_at >= $${params.length}`);
    }

    if (input.to) {
      params.push(input.to);
      conditions.push(`b.posted_at <= $${params.length}`);
    }

    if (input.playerId) {
      params.push(input.playerId);
      conditions.push(
        `EXISTS (
          SELECT 1 FROM ledger_accounts sa
          WHERE sa.id IN (e.source_account_id, e.destination_account_id)
            AND sa.player_id = $${params.length}
        )`
      );
    }

    const whereSql = conditions.join(" AND ");

    const totalResult = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM ledger_entries e
      INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
      WHERE ${whereSql}
      `,
      params
    );

    params.push(input.pageSize, (input.page - 1) * input.pageSize);

    const itemsResult = await this.db.query<{
      entry_id: string;
      posted_at: string;
      match_id: string | null;
      amount_vnd: number;
      entry_reason: string;
      source_player_id: string | null;
      source_player_name: string | null;
      destination_player_id: string | null;
      destination_player_name: string | null;
      source_account_type: string;
      destination_account_type: string;
      rule_code: string | null;
      rule_name: string | null;
    }>(
      `
      SELECT
        e.id AS entry_id,
        b.posted_at,
        b.match_id,
        e.amount_vnd,
        e.entry_reason,
        spa.id AS source_player_id,
        spa.display_name AS source_player_name,
        dpa.id AS destination_player_id,
        dpa.display_name AS destination_player_name,
        sa.account_type AS source_account_type,
        da.account_type AS destination_account_type,
        msl.rule_code,
        msl.rule_name
      FROM ledger_entries e
      INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
      INNER JOIN ledger_accounts sa ON sa.id = e.source_account_id
      INNER JOIN ledger_accounts da ON da.id = e.destination_account_id
      LEFT JOIN players spa ON spa.id = sa.player_id
      LEFT JOIN players dpa ON dpa.id = da.player_id
      LEFT JOIN match_settlement_lines msl ON msl.id = e.match_settlement_line_id
      WHERE ${whereSql}
      ORDER BY b.posted_at DESC, e.entry_order ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: itemsResult.rows,
      total: Number(totalResult.rows[0]?.count ?? "0")
    };
  }

  public async getMatchStakesSummary(groupId: string, from?: string, to?: string): Promise<
    Array<{
      playerId: string;
      playerName: string;
      totalNetVnd: number;
      totalMatches: number;
      firstPlaceCountAmongParticipants: number;
      biggestLossCount: number;
    }>
  > {
    const dateConditions: string[] = [];
    const params: unknown[] = [groupId, "MATCH_STAKES"];

    if (from) {
      params.push(from);
      dateConditions.push(`m.played_at >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      dateConditions.push(`m.played_at <= $${params.length}`);
    }

    const dateFilterSql = dateConditions.length > 0 ? `AND ${dateConditions.join(" AND ")}` : "";

    const result = await this.db.query<{
      player_id: string;
      player_name: string;
      total_net_vnd: number;
      total_matches: number;
      first_place_count_among_participants: number;
      biggest_loss_count: number;
    }>(
      `
      WITH match_scope AS (
        SELECT id
        FROM matches m
        WHERE m.group_id = $1
          AND m.module = $2
          AND m.status <> 'VOIDED'
          ${dateFilterSql}
      ),
      player_net AS (
        SELECT
          p.id AS player_id,
          p.display_name AS player_name,
          COALESCE(SUM(
            CASE
              WHEN da.player_id = p.id THEN e.amount_vnd
              WHEN sa.player_id = p.id THEN -e.amount_vnd
              ELSE 0
            END
          ), 0) AS total_net_vnd
        FROM players p
        INNER JOIN group_members gm ON gm.player_id = p.id AND gm.group_id = $1 AND gm.is_active = TRUE
        LEFT JOIN ledger_accounts pa ON pa.player_id = p.id AND pa.group_id = $1
        LEFT JOIN ledger_entries e ON e.source_account_id = pa.id OR e.destination_account_id = pa.id
        LEFT JOIN ledger_entry_batches b ON b.id = e.batch_id AND b.module = $2
        LEFT JOIN ledger_accounts sa ON sa.id = e.source_account_id
        LEFT JOIN ledger_accounts da ON da.id = e.destination_account_id
        WHERE p.is_active = TRUE
        GROUP BY p.id, p.display_name
      ),
      player_stats AS (
        SELECT
          mp.player_id,
          COUNT(*)::int AS total_matches,
          COUNT(*) FILTER (WHERE mp.relative_rank = 1)::int AS first_place_count_among_participants,
          COUNT(*) FILTER (WHERE mp.relative_rank = m.participant_count)::int AS biggest_loss_count
        FROM match_participants mp
        INNER JOIN matches m ON m.id = mp.match_id
        INNER JOIN match_scope ms ON ms.id = m.id
        GROUP BY mp.player_id
      )
      SELECT
        pn.player_id,
        pn.player_name,
        pn.total_net_vnd,
        COALESCE(ps.total_matches, 0) AS total_matches,
        COALESCE(ps.first_place_count_among_participants, 0) AS first_place_count_among_participants,
        COALESCE(ps.biggest_loss_count, 0) AS biggest_loss_count
      FROM player_net pn
      LEFT JOIN player_stats ps ON ps.player_id = pn.player_id
      ORDER BY pn.player_name ASC
      `,
      params
    );

    return result.rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      totalNetVnd: row.total_net_vnd,
      totalMatches: row.total_matches,
      firstPlaceCountAmongParticipants: row.first_place_count_among_participants,
      biggestLossCount: row.biggest_loss_count
    }));
  }

  public async getGroupFundSummary(groupId: string, from?: string, to?: string): Promise<{
    fundBalanceVnd: number;
    players: Array<{
      playerId: string;
      playerName: string;
      totalContributedVnd: number;
      currentObligationVnd: number;
    }>;
  }> {
    const rangeConditions: string[] = [];
    const params: unknown[] = [groupId, "GROUP_FUND"];

    if (from) {
      params.push(from);
      rangeConditions.push(`b.posted_at >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      rangeConditions.push(`b.posted_at <= $${params.length}`);
    }

    const rangeFilter = rangeConditions.length > 0 ? `AND ${rangeConditions.join(" AND ")}` : "";

    const fundResult = await this.db.query<{ fund_balance_vnd: number }>(
      `
      SELECT COALESCE(SUM(
        CASE
          WHEN da.account_type = 'FUND_MAIN' THEN e.amount_vnd
          WHEN sa.account_type = 'FUND_MAIN' THEN -e.amount_vnd
          ELSE 0
        END
      ), 0) AS fund_balance_vnd
      FROM ledger_entries e
      INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
      INNER JOIN ledger_accounts sa ON sa.id = e.source_account_id
      INNER JOIN ledger_accounts da ON da.id = e.destination_account_id
      WHERE b.group_id = $1
        AND b.module = $2
        ${rangeFilter}
      `,
      params
    );

    const playerResult = await this.db.query<{
      player_id: string;
      player_name: string;
      total_contributed_vnd: number;
      current_obligation_vnd: number;
    }>(
      `
      SELECT
        p.id AS player_id,
        p.display_name AS player_name,
        COALESCE(SUM(CASE WHEN da.account_type = 'FUND_MAIN' AND sa.player_id = p.id THEN e.amount_vnd ELSE 0 END), 0) AS total_contributed_vnd,
        GREATEST(
          COALESCE(SUM(CASE WHEN sa.player_id = p.id THEN e.amount_vnd ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN da.player_id = p.id THEN e.amount_vnd ELSE 0 END), 0),
          0
        ) AS current_obligation_vnd
      FROM players p
      INNER JOIN group_members gm ON gm.player_id = p.id AND gm.group_id = $1 AND gm.is_active = TRUE
      LEFT JOIN ledger_accounts pa ON pa.player_id = p.id AND pa.group_id = $1 AND pa.account_type = 'PLAYER_FUND_OBLIGATION'
      LEFT JOIN ledger_entries e ON e.source_account_id = pa.id OR e.destination_account_id = pa.id
      LEFT JOIN ledger_entry_batches b ON b.id = e.batch_id AND b.module = $2
      LEFT JOIN ledger_accounts sa ON sa.id = e.source_account_id
      LEFT JOIN ledger_accounts da ON da.id = e.destination_account_id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.display_name
      ORDER BY p.display_name ASC
      `,
      [groupId, "GROUP_FUND"]
    );

    return {
      fundBalanceVnd: fundResult.rows[0]?.fund_balance_vnd ?? 0,
      players: playerResult.rows.map((row) => ({
        playerId: row.player_id,
        playerName: row.player_name,
        totalContributedVnd: row.total_contributed_vnd,
        currentObligationVnd: row.current_obligation_vnd
      }))
    };
  }

  public async listManualGroupFundTransactions(input: {
    groupId: string;
    transactionType?: GroupFundTransactionType;
    playerId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: any[]; total: number }> {
    const transactionTypeCase = `
      CASE
        WHEN sa.account_type = 'PLAYER_FUND_OBLIGATION' AND da.account_type = 'FUND_MAIN' THEN 'CONTRIBUTION'
        WHEN sa.account_type = 'FUND_MAIN' AND da.account_type = 'PLAYER_FUND_OBLIGATION' THEN 'WITHDRAWAL'
        WHEN sa.account_type = 'SYSTEM_HOLDING' AND da.account_type = 'FUND_MAIN' THEN 'ADJUSTMENT_IN'
        WHEN sa.account_type = 'FUND_MAIN' AND da.account_type = 'SYSTEM_HOLDING' THEN 'ADJUSTMENT_OUT'
        ELSE NULL
      END
    `;

    const conditions = [
      "b.group_id = $1",
      "b.module = 'GROUP_FUND'",
      "b.source_type IN ('MANUAL_ADJUSTMENT', 'SYSTEM_CORRECTION')",
      `${transactionTypeCase} IS NOT NULL`
    ];
    const params: unknown[] = [input.groupId];

    if (input.from) {
      params.push(input.from);
      conditions.push(`b.posted_at >= $${params.length}`);
    }

    if (input.to) {
      params.push(input.to);
      conditions.push(`b.posted_at <= $${params.length}`);
    }

    if (input.playerId) {
      params.push(input.playerId);
      conditions.push(`(sa.player_id = $${params.length} OR da.player_id = $${params.length})`);
    }

    if (input.transactionType) {
      params.push(input.transactionType);
      conditions.push(`${transactionTypeCase} = $${params.length}`);
    }

    const whereSql = conditions.join(" AND ");

    const totalResult = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM ledger_entries e
      INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
      INNER JOIN ledger_accounts sa ON sa.id = e.source_account_id
      INNER JOIN ledger_accounts da ON da.id = e.destination_account_id
      WHERE ${whereSql}
      `,
      params
    );

    params.push(input.pageSize, (input.page - 1) * input.pageSize);

    const itemsResult = await this.db.query<{
      entry_id: string;
      batch_id: string;
      posted_at: string;
      source_type: string;
      transaction_type: GroupFundTransactionType;
      player_id: string | null;
      player_name: string | null;
      amount_vnd: number;
      entry_reason: string;
    }>(
      `
      SELECT
        e.id AS entry_id,
        b.id AS batch_id,
        b.posted_at,
        b.source_type,
        ${transactionTypeCase} AS transaction_type,
        COALESCE(sa.player_id, da.player_id) AS player_id,
        COALESCE(sp.display_name, dp.display_name) AS player_name,
        e.amount_vnd,
        e.entry_reason
      FROM ledger_entries e
      INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
      INNER JOIN ledger_accounts sa ON sa.id = e.source_account_id
      INNER JOIN ledger_accounts da ON da.id = e.destination_account_id
      LEFT JOIN players sp ON sp.id = sa.player_id
      LEFT JOIN players dp ON dp.id = da.player_id
      WHERE ${whereSql}
      ORDER BY b.posted_at DESC, e.entry_order ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: itemsResult.rows,
      total: Number(totalResult.rows[0]?.count ?? "0")
    };
  }
}
