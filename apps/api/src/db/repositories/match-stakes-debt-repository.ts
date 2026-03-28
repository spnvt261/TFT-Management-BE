import { conflict } from "../../core/errors/app-error.js";
import type { MatchStakesDebtPeriodRecord } from "../../domain/models/records.js";
import type { Queryable } from "../postgres/transaction.js";

function mapDebtPeriod(row: {
  id: string;
  group_id: string;
  period_no: number;
  title: string | null;
  note: string | null;
  close_note: string | null;
  closing_snapshot_json: unknown | null;
  next_period_id: string | null;
  status: "OPEN" | "CLOSED";
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}): MatchStakesDebtPeriodRecord {
  return {
    id: row.id,
    groupId: row.group_id,
    periodNo: row.period_no,
    title: row.title,
    note: row.note,
    closeNote: row.close_note,
    closingSnapshotJson: row.closing_snapshot_json,
    nextPeriodId: row.next_period_id,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export interface DebtPeriodPlayerAggregateRow {
  playerId: string;
  playerName: string;
  totalMatches: number;
  initNetVnd: number;
  accruedNetVnd: number;
  settledPaidVnd: number;
  settledReceivedVnd: number;
}

export interface DebtPeriodInitBalanceRow {
  playerId: string;
  playerName: string;
  initNetVnd: number;
}

export interface DebtSettlementLineInsertInput {
  payerPlayerId: string;
  receiverPlayerId: string;
  amountVnd: number;
  note: string | null;
}

export interface DebtPeriodMatchTimelineRow {
  id: string;
  playedAt: string;
  periodMatchNo: number | null;
  participantCount: number;
  status: string;
  createdAt: string;
}

export interface DebtPeriodMatchParticipantTimelineRow {
  matchId: string;
  playerId: string;
  playerName: string;
  tftPlacement: number;
  relativeRank: number;
  settlementNetVnd: number;
}

export class MatchStakesDebtRepository {
  public constructor(private readonly db: Queryable) {}

  public async getCurrentOpenPeriod(groupId: string): Promise<MatchStakesDebtPeriodRecord | null> {
    const result = await this.db.query<{
      id: string;
      group_id: string;
      period_no: number;
      title: string | null;
      note: string | null;
      close_note: string | null;
      closing_snapshot_json: unknown | null;
      next_period_id: string | null;
      status: "OPEN" | "CLOSED";
      opened_at: string;
      closed_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id, group_id, period_no, title, note, close_note, closing_snapshot_json, next_period_id,
        status, opened_at, closed_at, created_at, updated_at
      FROM match_stakes_debt_periods
      WHERE group_id = $1 AND status = 'OPEN'
      LIMIT 1
      `,
      [groupId]
    );

    const row = result.rows[0];
    return row ? mapDebtPeriod(row) : null;
  }

  public async getPeriodById(groupId: string, periodId: string): Promise<MatchStakesDebtPeriodRecord | null> {
    const result = await this.db.query<{
      id: string;
      group_id: string;
      period_no: number;
      title: string | null;
      note: string | null;
      close_note: string | null;
      closing_snapshot_json: unknown | null;
      next_period_id: string | null;
      status: "OPEN" | "CLOSED";
      opened_at: string;
      closed_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id, group_id, period_no, title, note, close_note, closing_snapshot_json, next_period_id,
        status, opened_at, closed_at, created_at, updated_at
      FROM match_stakes_debt_periods
      WHERE id = $1 AND group_id = $2
      LIMIT 1
      `,
      [periodId, groupId]
    );

    const row = result.rows[0];
    return row ? mapDebtPeriod(row) : null;
  }

  public async listPeriods(input: {
    groupId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: MatchStakesDebtPeriodRecord[]; total: number }> {
    const totalResult = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM match_stakes_debt_periods
      WHERE group_id = $1
      `,
      [input.groupId]
    );

    const result = await this.db.query<{
      id: string;
      group_id: string;
      period_no: number;
      title: string | null;
      note: string | null;
      close_note: string | null;
      closing_snapshot_json: unknown | null;
      next_period_id: string | null;
      status: "OPEN" | "CLOSED";
      opened_at: string;
      closed_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id, group_id, period_no, title, note, close_note, closing_snapshot_json, next_period_id,
        status, opened_at, closed_at, created_at, updated_at
      FROM match_stakes_debt_periods
      WHERE group_id = $1
      ORDER BY opened_at DESC, created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [input.groupId, input.pageSize, (input.page - 1) * input.pageSize]
    );

    return {
      items: result.rows.map(mapDebtPeriod),
      total: Number(totalResult.rows[0]?.count ?? "0")
    };
  }

  public async createOpenPeriod(input: {
    groupId: string;
    title: string | null;
    note: string | null;
  }): Promise<MatchStakesDebtPeriodRecord> {
    try {
      const result = await this.db.query<{
        id: string;
        group_id: string;
        period_no: number;
        title: string | null;
        note: string | null;
        close_note: string | null;
        closing_snapshot_json: unknown | null;
        next_period_id: string | null;
        status: "OPEN" | "CLOSED";
        opened_at: string;
        closed_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `
        WITH next_period AS (
          SELECT COALESCE(MAX(period_no), 0) + 1 AS period_no
          FROM match_stakes_debt_periods
          WHERE group_id = $1
        )
        INSERT INTO match_stakes_debt_periods(group_id, period_no, title, note, status)
        SELECT $1, next_period.period_no, $2, $3, 'OPEN'
        FROM next_period
        RETURNING
          id, group_id, period_no, title, note, close_note, closing_snapshot_json, next_period_id,
          status, opened_at, closed_at, created_at, updated_at
        `,
        [input.groupId, input.title, input.note]
      );

      return mapDebtPeriod(result.rows[0]!);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw conflict("DEBT_PERIOD_OPEN_ALREADY_EXISTS", "An open debt period already exists for this group");
      }
      throw error;
    }
  }

  public async getOrCreateOpenPeriod(groupId: string): Promise<MatchStakesDebtPeriodRecord> {
    const existing = await this.getCurrentOpenPeriod(groupId);
    if (existing) {
      return existing;
    }

    try {
      return await this.createOpenPeriod({
        groupId,
        title: null,
        note: null
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error) || (typeof error === "object" && error !== null && "code" in error)) {
        const reloaded = await this.getCurrentOpenPeriod(groupId);
        if (reloaded) {
          return reloaded;
        }
      }
      throw error;
    }
  }

  public async listPeriodPlayerAggregates(groupId: string, periodId: string): Promise<DebtPeriodPlayerAggregateRow[]> {
    const result = await this.db.query<{
      player_id: string;
      player_name: string;
      total_matches: number;
      init_net_vnd: number;
      accrued_net_vnd: number;
      settled_paid_vnd: number;
      settled_received_vnd: number;
    }>(
      `
      WITH active_players AS (
        SELECT p.id AS player_id, p.display_name AS player_name
        FROM players p
        INNER JOIN group_members gm ON gm.player_id = p.id
        WHERE gm.group_id = $1
          AND gm.is_active = TRUE
          AND p.is_active = TRUE
      ),
      init_agg AS (
        SELECT
          ib.player_id,
          COALESCE(SUM(ib.init_net_vnd), 0)::bigint AS init_net_vnd
        FROM match_stakes_debt_period_init_balances ib
        INNER JOIN match_stakes_debt_periods dp ON dp.id = ib.debt_period_id
        WHERE dp.group_id = $1
          AND ib.debt_period_id = $2
        GROUP BY ib.player_id
      ),
      match_agg AS (
        SELECT
          mp.player_id,
          COUNT(*)::int AS total_matches,
          COALESCE(SUM(mp.settlement_net_vnd), 0)::bigint AS accrued_net_vnd
        FROM match_participants mp
        INNER JOIN matches m ON m.id = mp.match_id
        WHERE m.group_id = $1
          AND m.module = 'MATCH_STAKES'
          AND m.debt_period_id = $2
          AND m.status <> 'VOIDED'
        GROUP BY mp.player_id
      ),
      paid_agg AS (
        SELECT
          l.payer_player_id AS player_id,
          COALESCE(SUM(l.amount_vnd), 0)::bigint AS settled_paid_vnd
        FROM match_stakes_debt_settlement_lines l
        INNER JOIN match_stakes_debt_settlements s ON s.id = l.settlement_id
        WHERE s.group_id = $1
          AND s.debt_period_id = $2
        GROUP BY l.payer_player_id
      ),
      received_agg AS (
        SELECT
          l.receiver_player_id AS player_id,
          COALESCE(SUM(l.amount_vnd), 0)::bigint AS settled_received_vnd
        FROM match_stakes_debt_settlement_lines l
        INNER JOIN match_stakes_debt_settlements s ON s.id = l.settlement_id
        WHERE s.group_id = $1
          AND s.debt_period_id = $2
        GROUP BY l.receiver_player_id
      ),
      event_agg AS (
        SELECT
          i.player_id,
          COALESCE(SUM(i.net_delta_vnd), 0)::bigint AS event_net_vnd
        FROM match_stakes_history_event_player_impacts i
        INNER JOIN module_history_events e ON e.id = i.history_event_id
        WHERE i.group_id = $1
          AND i.debt_period_id = $2
          AND e.event_status = 'ACTIVE'
        GROUP BY i.player_id
      ),
      activity_players AS (
        SELECT player_id FROM init_agg
        UNION
        SELECT player_id FROM match_agg
        UNION
        SELECT player_id FROM paid_agg
        UNION
        SELECT player_id FROM received_agg
        UNION
        SELECT player_id FROM event_agg
      ),
      player_scope AS (
        SELECT ap.player_id, ap.player_name
        FROM active_players ap
        UNION
        SELECT p.id AS player_id, p.display_name AS player_name
        FROM activity_players a
        INNER JOIN players p ON p.id = a.player_id
      )
      SELECT
        ps.player_id,
        ps.player_name,
        COALESCE(ma.total_matches, 0) AS total_matches,
        COALESCE(ia.init_net_vnd, 0) AS init_net_vnd,
        (COALESCE(ma.accrued_net_vnd, 0) + COALESCE(ea.event_net_vnd, 0))::bigint AS accrued_net_vnd,
        COALESCE(pa.settled_paid_vnd, 0) AS settled_paid_vnd,
        COALESCE(ra.settled_received_vnd, 0) AS settled_received_vnd
      FROM player_scope ps
      LEFT JOIN init_agg ia ON ia.player_id = ps.player_id
      LEFT JOIN match_agg ma ON ma.player_id = ps.player_id
      LEFT JOIN paid_agg pa ON pa.player_id = ps.player_id
      LEFT JOIN received_agg ra ON ra.player_id = ps.player_id
      LEFT JOIN event_agg ea ON ea.player_id = ps.player_id
      `,
      [groupId, periodId]
    );

    return result.rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      totalMatches: row.total_matches,
      initNetVnd: row.init_net_vnd,
      accruedNetVnd: row.accrued_net_vnd,
      settledPaidVnd: row.settled_paid_vnd,
      settledReceivedVnd: row.settled_received_vnd
    }));
  }

  public async listPeriodInitBalances(groupId: string, periodId: string): Promise<DebtPeriodInitBalanceRow[]> {
    const result = await this.db.query<{
      player_id: string;
      player_name: string;
      init_net_vnd: number;
    }>(
      `
      SELECT
        ib.player_id,
        p.display_name AS player_name,
        ib.init_net_vnd
      FROM match_stakes_debt_period_init_balances ib
      INNER JOIN players p ON p.id = ib.player_id
      INNER JOIN match_stakes_debt_periods dp ON dp.id = ib.debt_period_id
      WHERE ib.debt_period_id = $1
        AND dp.group_id = $2
      ORDER BY p.display_name ASC, ib.player_id ASC
      `,
      [periodId, groupId]
    );

    return result.rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      initNetVnd: row.init_net_vnd
    }));
  }

  public async replacePeriodInitBalances(
    periodId: string,
    balances: Array<{
      playerId: string;
      initNetVnd: number;
    }>
  ): Promise<void> {
    await this.db.query(`DELETE FROM match_stakes_debt_period_init_balances WHERE debt_period_id = $1`, [periodId]);

    for (const balance of balances) {
      if (balance.initNetVnd === 0) {
        continue;
      }

      await this.db.query(
        `
        INSERT INTO match_stakes_debt_period_init_balances(debt_period_id, player_id, init_net_vnd)
        VALUES ($1, $2, $3)
        ON CONFLICT (debt_period_id, player_id)
        DO UPDATE SET init_net_vnd = EXCLUDED.init_net_vnd
        `,
        [periodId, balance.playerId, balance.initNetVnd]
      );
    }
  }

  public async countNonVoidedMatchesInPeriod(groupId: string, periodId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM matches
      WHERE group_id = $1
        AND module = 'MATCH_STAKES'
        AND debt_period_id = $2
        AND status <> 'VOIDED'
      `,
      [groupId, periodId]
    );

    return Number(result.rows[0]?.count ?? "0");
  }

  public async listNonVoidedPeriodMatches(input: { groupId: string; debtPeriodId: string }): Promise<DebtPeriodMatchTimelineRow[]> {
    const result = await this.db.query<{
      id: string;
      played_at: string;
      period_match_no: number | null;
      participant_count: number;
      status: string;
      created_at: string;
    }>(
      `
      SELECT id, played_at, period_match_no, participant_count, status, created_at
      FROM matches
      WHERE group_id = $1
        AND module = 'MATCH_STAKES'
        AND debt_period_id = $2
        AND status <> 'VOIDED'
      ORDER BY period_match_no ASC NULLS LAST, played_at ASC, created_at ASC, id ASC
      `,
      [input.groupId, input.debtPeriodId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      playedAt: row.played_at,
      periodMatchNo: row.period_match_no,
      participantCount: row.participant_count,
      status: row.status,
      createdAt: row.created_at
    }));
  }

  public async listMatchParticipantsByMatchIds(matchIds: string[]): Promise<DebtPeriodMatchParticipantTimelineRow[]> {
    if (matchIds.length === 0) {
      return [];
    }

    const result = await this.db.query<{
      match_id: string;
      player_id: string;
      player_name: string;
      tft_placement: number;
      relative_rank: number;
      settlement_net_vnd: number;
    }>(
      `
      SELECT
        mp.match_id,
        mp.player_id,
        p.display_name AS player_name,
        mp.tft_placement,
        mp.relative_rank,
        mp.settlement_net_vnd
      FROM match_participants mp
      INNER JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = ANY($1::uuid[])
      ORDER BY mp.match_id ASC, mp.relative_rank ASC, mp.created_at ASC
      `,
      [matchIds]
    );

    return result.rows.map((row) => ({
      matchId: row.match_id,
      playerId: row.player_id,
      playerName: row.player_name,
      tftPlacement: row.tft_placement,
      relativeRank: row.relative_rank,
      settlementNetVnd: row.settlement_net_vnd
    }));
  }

  public async createSettlement(input: {
    groupId: string;
    debtPeriodId: string;
    postedAt: string;
    note: string | null;
  }): Promise<{ id: string; postedAt: string; note: string | null; createdAt: string; updatedAt: string }> {
    const result = await this.db.query<{
      id: string;
      posted_at: string;
      note: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO match_stakes_debt_settlements(group_id, debt_period_id, posted_at, note)
      VALUES ($1, $2, $3, $4)
      RETURNING id, posted_at, note, created_at, updated_at
      `,
      [input.groupId, input.debtPeriodId, input.postedAt, input.note]
    );

    const row = result.rows[0]!;
    return {
      id: row.id,
      postedAt: row.posted_at,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async insertSettlementLines(
    settlementId: string,
    debtPeriodId: string,
    lines: DebtSettlementLineInsertInput[]
  ): Promise<
    Array<{
      id: string;
      settlementId: string;
      debtPeriodId: string;
      payerPlayerId: string;
      receiverPlayerId: string;
      amountVnd: number;
      note: string | null;
      createdAt: string;
    }>
  > {
    const created: Array<{
      id: string;
      settlementId: string;
      debtPeriodId: string;
      payerPlayerId: string;
      receiverPlayerId: string;
      amountVnd: number;
      note: string | null;
      createdAt: string;
    }> = [];

    for (const line of lines) {
      const result = await this.db.query<{
        id: string;
        settlement_id: string;
        debt_period_id: string;
        payer_player_id: string;
        receiver_player_id: string;
        amount_vnd: number;
        note: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO match_stakes_debt_settlement_lines(
          settlement_id, debt_period_id, payer_player_id, receiver_player_id, amount_vnd, note
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, settlement_id, debt_period_id, payer_player_id, receiver_player_id, amount_vnd, note, created_at
        `,
        [settlementId, debtPeriodId, line.payerPlayerId, line.receiverPlayerId, line.amountVnd, line.note]
      );

      const row = result.rows[0]!;
      created.push({
        id: row.id,
        settlementId: row.settlement_id,
        debtPeriodId: row.debt_period_id,
        payerPlayerId: row.payer_player_id,
        receiverPlayerId: row.receiver_player_id,
        amountVnd: row.amount_vnd,
        note: row.note,
        createdAt: row.created_at
      });
    }

    return created;
  }

  public async listSettlementsWithLines(input: {
    groupId: string;
    debtPeriodId: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      postedAt: string;
      note: string | null;
      createdAt: string;
      updatedAt: string;
      lines: Array<{
        id: string;
        payerPlayerId: string;
        payerPlayerName: string;
        receiverPlayerId: string;
        receiverPlayerName: string;
        amountVnd: number;
        note: string | null;
        createdAt: string;
      }>;
    }>
  > {
    const limit = input.limit ?? 30;
    const settlementsResult = await this.db.query<{
      id: string;
      posted_at: string;
      note: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, posted_at, note, created_at, updated_at
      FROM match_stakes_debt_settlements
      WHERE group_id = $1 AND debt_period_id = $2
      ORDER BY posted_at DESC, created_at DESC
      LIMIT $3
      `,
      [input.groupId, input.debtPeriodId, limit]
    );

    if (settlementsResult.rows.length === 0) {
      return [];
    }

    const settlementIds = settlementsResult.rows.map((row) => row.id);
    const linesResult = await this.db.query<{
      id: string;
      settlement_id: string;
      payer_player_id: string;
      payer_player_name: string;
      receiver_player_id: string;
      receiver_player_name: string;
      amount_vnd: number;
      note: string | null;
      created_at: string;
    }>(
      `
      SELECT
        l.id,
        l.settlement_id,
        l.payer_player_id,
        pp.display_name AS payer_player_name,
        l.receiver_player_id,
        rp.display_name AS receiver_player_name,
        l.amount_vnd,
        l.note,
        l.created_at
      FROM match_stakes_debt_settlement_lines l
      INNER JOIN players pp ON pp.id = l.payer_player_id
      INNER JOIN players rp ON rp.id = l.receiver_player_id
      WHERE l.settlement_id = ANY($1::uuid[])
      ORDER BY l.created_at ASC
      `,
      [settlementIds]
    );

    const grouped = new Map<
      string,
      Array<{
        id: string;
        payerPlayerId: string;
        payerPlayerName: string;
        receiverPlayerId: string;
        receiverPlayerName: string;
        amountVnd: number;
        note: string | null;
        createdAt: string;
      }>
    >();

    for (const row of linesResult.rows) {
      const current = grouped.get(row.settlement_id) ?? [];
      current.push({
        id: row.id,
        payerPlayerId: row.payer_player_id,
        payerPlayerName: row.payer_player_name,
        receiverPlayerId: row.receiver_player_id,
        receiverPlayerName: row.receiver_player_name,
        amountVnd: row.amount_vnd,
        note: row.note,
        createdAt: row.created_at
      });
      grouped.set(row.settlement_id, current);
    }

    return settlementsResult.rows.map((row) => ({
      id: row.id,
      postedAt: row.posted_at,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lines: grouped.get(row.id) ?? []
    }));
  }

  public async closeOpenPeriod(input: {
    groupId: string;
    periodId: string;
    closeNote: string | null;
    closingSnapshot: unknown;
    nextPeriodId: string | null;
  }): Promise<MatchStakesDebtPeriodRecord | null> {
    const result = await this.db.query<{
      id: string;
      group_id: string;
      period_no: number;
      title: string | null;
      note: string | null;
      close_note: string | null;
      closing_snapshot_json: unknown | null;
      next_period_id: string | null;
      status: "OPEN" | "CLOSED";
      opened_at: string;
      closed_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      UPDATE match_stakes_debt_periods
      SET
        status = 'CLOSED',
        closed_at = now(),
        close_note = $3,
        closing_snapshot_json = $4,
        next_period_id = $5,
        updated_at = now()
      WHERE id = $1
        AND group_id = $2
        AND status = 'OPEN'
      RETURNING
        id, group_id, period_no, title, note, close_note, closing_snapshot_json, next_period_id,
        status, opened_at, closed_at, created_at, updated_at
      `,
      [input.periodId, input.groupId, input.closeNote, input.closingSnapshot, input.nextPeriodId]
    );

    const row = result.rows[0];
    return row ? mapDebtPeriod(row) : null;
  }

  public async setNextPeriodId(periodId: string, nextPeriodId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE match_stakes_debt_periods
      SET next_period_id = $2, updated_at = now()
      WHERE id = $1
      `,
      [periodId, nextPeriodId]
    );
  }
}
