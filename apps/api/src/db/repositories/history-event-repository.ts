import type { HistoryEventType, MatchStakesImpactMode, ModuleHistoryEventStatus, ModuleType } from "../../domain/models/enums.js";
import type { ModuleHistoryEventRecord } from "../../domain/models/records.js";
import type { Queryable } from "../postgres/transaction.js";

interface ModuleHistoryEventRow {
  id: string;
  group_id: string;
  module: ModuleType;
  event_type: HistoryEventType;
  event_status: ModuleHistoryEventStatus;
  reset_at: string | null;
  reset_reason: string | null;
  posted_at: string;
  note: string | null;
  amount_vnd: number | null;
  match_stakes_impact_mode: MatchStakesImpactMode | null;
  affects_debt: boolean;
  player_id: string | null;
  secondary_player_id: string | null;
  debt_period_id: string | null;
  match_id: string | null;
  ledger_batch_id: string | null;
  balance_before_vnd: number | null;
  balance_after_vnd: number | null;
  outstanding_before_vnd: number | null;
  outstanding_after_vnd: number | null;
  metadata_json: unknown;
  created_by_role_code: string | null;
  created_at: string;
  updated_at: string;
}

function mapHistoryEvent(row: ModuleHistoryEventRow): ModuleHistoryEventRecord {
  return {
    id: row.id,
    groupId: row.group_id,
    module: row.module,
    eventType: row.event_type,
    eventStatus: row.event_status,
    resetAt: row.reset_at,
    resetReason: row.reset_reason,
    postedAt: row.posted_at,
    note: row.note,
    amountVnd: row.amount_vnd,
    matchStakesImpactMode: row.match_stakes_impact_mode,
    affectsDebt: row.affects_debt,
    playerId: row.player_id,
    secondaryPlayerId: row.secondary_player_id,
    debtPeriodId: row.debt_period_id,
    matchId: row.match_id,
    ledgerBatchId: row.ledger_batch_id,
    balanceBeforeVnd: row.balance_before_vnd,
    balanceAfterVnd: row.balance_after_vnd,
    outstandingBeforeVnd: row.outstanding_before_vnd,
    outstandingAfterVnd: row.outstanding_after_vnd,
    metadataJson: row.metadata_json,
    createdByRoleCode: row.created_by_role_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface CreateModuleHistoryEventInput {
  groupId: string;
  module: ModuleType;
  eventType: HistoryEventType;
  postedAt: string;
  note: string | null;
  amountVnd: number | null;
  matchStakesImpactMode: MatchStakesImpactMode | null;
  affectsDebt: boolean;
  playerId: string | null;
  secondaryPlayerId: string | null;
  debtPeriodId: string | null;
  matchId: string | null;
  ledgerBatchId: string | null;
  balanceBeforeVnd: number | null;
  balanceAfterVnd: number | null;
  outstandingBeforeVnd: number | null;
  outstandingAfterVnd: number | null;
  metadataJson?: unknown;
  createdByRoleCode: string | null;
}

export interface MatchStakesHistoryImpactInput {
  playerId: string;
  netDeltaVnd: number;
}

export interface MatchStakesPeriodHistoryEventRecord {
  id: string;
  eventType: HistoryEventType;
  eventStatus: ModuleHistoryEventStatus;
  resetAt: string | null;
  resetReason: string | null;
  postedAt: string;
  createdAt: string;
  amountVnd: number | null;
  note: string | null;
  impactMode: MatchStakesImpactMode | null;
  affectsDebt: boolean;
  playerId: string | null;
  playerName: string | null;
  outstandingBeforeVnd: number | null;
  outstandingAfterVnd: number | null;
  metadata: unknown;
}

export interface MatchStakesPeriodHistoryImpactRecord {
  historyEventId: string;
  playerId: string;
  playerName: string;
  netDeltaVnd: number;
}

export interface UnifiedHistoryFeedItemRecord {
  id: string;
  module: ModuleType;
  itemType: string;
  eventType: HistoryEventType | null;
  impactMode: MatchStakesImpactMode | null;
  affectsDebt: boolean | null;
  eventStatus: ModuleHistoryEventStatus | null;
  resetAt: string | null;
  resetReason: string | null;
  postedAt: string;
  createdAt: string;
  title: string;
  description: string | null;
  amountVnd: number | null;
  playerId: string | null;
  playerName: string | null;
  secondaryPlayerId: string | null;
  secondaryPlayerName: string | null;
  matchId: string | null;
  debtPeriodId: string | null;
  ledgerBatchId: string | null;
  balanceBeforeVnd: number | null;
  balanceAfterVnd: number | null;
  outstandingBeforeVnd: number | null;
  outstandingAfterVnd: number | null;
  note: string | null;
  metadata: unknown;
}

interface UnifiedHistoryFeedRow {
  id: string;
  module: ModuleType;
  item_type: string;
  event_type: HistoryEventType | null;
  match_stakes_impact_mode: MatchStakesImpactMode | null;
  affects_debt: boolean | null;
  event_status: ModuleHistoryEventStatus | null;
  reset_at: string | null;
  reset_reason: string | null;
  posted_at: string;
  created_at: string;
  title: string;
  description: string | null;
  amount_vnd: number | null;
  player_id: string | null;
  player_name: string | null;
  secondary_player_id: string | null;
  secondary_player_name: string | null;
  match_id: string | null;
  debt_period_id: string | null;
  ledger_batch_id: string | null;
  balance_before_vnd: number | null;
  balance_after_vnd: number | null;
  outstanding_before_vnd: number | null;
  outstanding_after_vnd: number | null;
  note: string | null;
  metadata_json: unknown;
  total_count: string;
}

function mapUnifiedHistoryItem(row: UnifiedHistoryFeedRow): UnifiedHistoryFeedItemRecord {
  return {
    id: row.id,
    module: row.module,
    itemType: row.item_type,
    eventType: row.event_type,
    impactMode: row.match_stakes_impact_mode,
    affectsDebt: row.affects_debt,
    eventStatus: row.event_status,
    resetAt: row.reset_at,
    resetReason: row.reset_reason,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    title: row.title,
    description: row.description,
    amountVnd: row.amount_vnd,
    playerId: row.player_id,
    playerName: row.player_name,
    secondaryPlayerId: row.secondary_player_id,
    secondaryPlayerName: row.secondary_player_name,
    matchId: row.match_id,
    debtPeriodId: row.debt_period_id,
    ledgerBatchId: row.ledger_batch_id,
    balanceBeforeVnd: row.balance_before_vnd,
    balanceAfterVnd: row.balance_after_vnd,
    outstandingBeforeVnd: row.outstanding_before_vnd,
    outstandingAfterVnd: row.outstanding_after_vnd,
    note: row.note,
    metadata: row.metadata_json
  };
}

export class HistoryEventRepository {
  public constructor(private readonly db: Queryable) {}

  public async createEvent(input: CreateModuleHistoryEventInput): Promise<ModuleHistoryEventRecord> {
    const result = await this.db.query<ModuleHistoryEventRow>(
      `
      INSERT INTO module_history_events(
        group_id,
        module,
        event_type,
        posted_at,
        note,
        amount_vnd,
        match_stakes_impact_mode,
        affects_debt,
        player_id,
        secondary_player_id,
        debt_period_id,
        match_id,
        ledger_batch_id,
        balance_before_vnd,
        balance_after_vnd,
        outstanding_before_vnd,
        outstanding_after_vnd,
        metadata_json,
        created_by_role_code
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, COALESCE($18::jsonb, '{}'::jsonb), $19
      )
      RETURNING
        id,
        group_id,
        module,
        event_type,
        event_status,
        reset_at,
        reset_reason,
        posted_at,
        note,
        amount_vnd,
        match_stakes_impact_mode,
        affects_debt,
        player_id,
        secondary_player_id,
        debt_period_id,
        match_id,
        ledger_batch_id,
        balance_before_vnd,
        balance_after_vnd,
        outstanding_before_vnd,
        outstanding_after_vnd,
        metadata_json,
        created_by_role_code,
        created_at,
        updated_at
      `,
      [
        input.groupId,
        input.module,
        input.eventType,
        input.postedAt,
        input.note,
        input.amountVnd,
        input.matchStakesImpactMode,
        input.affectsDebt,
        input.playerId,
        input.secondaryPlayerId,
        input.debtPeriodId,
        input.matchId,
        input.ledgerBatchId,
        input.balanceBeforeVnd,
        input.balanceAfterVnd,
        input.outstandingBeforeVnd,
        input.outstandingAfterVnd,
        input.metadataJson ?? null,
        input.createdByRoleCode
      ]
    );

    return mapHistoryEvent(result.rows[0]!);
  }

  public async getEventById(groupId: string, eventId: string): Promise<ModuleHistoryEventRecord | null> {
    const result = await this.db.query<ModuleHistoryEventRow>(
      `
      SELECT
        id,
        group_id,
        module,
        event_type,
        event_status,
        reset_at,
        reset_reason,
        posted_at,
        note,
        amount_vnd,
        match_stakes_impact_mode,
        affects_debt,
        player_id,
        secondary_player_id,
        debt_period_id,
        match_id,
        ledger_batch_id,
        balance_before_vnd,
        balance_after_vnd,
        outstanding_before_vnd,
        outstanding_after_vnd,
        metadata_json,
        created_by_role_code,
        created_at,
        updated_at
      FROM module_history_events
      WHERE group_id = $1
        AND id = $2
      LIMIT 1
      `,
      [groupId, eventId]
    );

    const row = result.rows[0];
    return row ? mapHistoryEvent(row) : null;
  }

  public async markEventReset(input: {
    groupId: string;
    eventId: string;
    resetReason: string | null;
  }): Promise<ModuleHistoryEventRecord | null> {
    const result = await this.db.query<ModuleHistoryEventRow>(
      `
      UPDATE module_history_events
      SET
        event_status = 'RESET',
        reset_at = now(),
        reset_reason = $3,
        updated_at = now()
      WHERE group_id = $1
        AND id = $2
        AND event_status = 'ACTIVE'
      RETURNING
        id,
        group_id,
        module,
        event_type,
        event_status,
        reset_at,
        reset_reason,
        posted_at,
        note,
        amount_vnd,
        match_stakes_impact_mode,
        affects_debt,
        player_id,
        secondary_player_id,
        debt_period_id,
        match_id,
        ledger_batch_id,
        balance_before_vnd,
        balance_after_vnd,
        outstanding_before_vnd,
        outstanding_after_vnd,
        metadata_json,
        created_by_role_code,
        created_at,
        updated_at
      `,
      [input.groupId, input.eventId, input.resetReason]
    );

    const row = result.rows[0];
    return row ? mapHistoryEvent(row) : null;
  }

  public async insertMatchStakesImpacts(
    historyEventId: string,
    groupId: string,
    debtPeriodId: string,
    impacts: MatchStakesHistoryImpactInput[]
  ): Promise<void> {
    for (const impact of impacts) {
      if (impact.netDeltaVnd === 0) {
        continue;
      }

      await this.db.query(
        `
        INSERT INTO match_stakes_history_event_player_impacts(
          history_event_id,
          group_id,
          debt_period_id,
          player_id,
          net_delta_vnd
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (history_event_id, player_id)
        DO UPDATE SET net_delta_vnd = EXCLUDED.net_delta_vnd
        `,
        [historyEventId, groupId, debtPeriodId, impact.playerId, impact.netDeltaVnd]
      );
    }
  }

  public async listMatchStakesPeriodEvents(input: {
    groupId: string;
    periodId: string;
  }): Promise<MatchStakesPeriodHistoryEventRecord[]> {
    const result = await this.db.query<{
      id: string;
      event_type: HistoryEventType;
      event_status: ModuleHistoryEventStatus;
      reset_at: string | null;
      reset_reason: string | null;
      posted_at: string;
      created_at: string;
      amount_vnd: number | null;
      note: string | null;
      match_stakes_impact_mode: MatchStakesImpactMode | null;
      affects_debt: boolean;
      player_id: string | null;
      player_name: string | null;
      outstanding_before_vnd: number | null;
      outstanding_after_vnd: number | null;
      metadata_json: unknown;
    }>(
      `
      SELECT
        e.id,
        e.event_type,
        e.event_status,
        e.reset_at,
        e.reset_reason,
        e.posted_at,
        e.created_at,
        e.amount_vnd,
        e.note,
        e.match_stakes_impact_mode,
        e.affects_debt,
        e.player_id,
        p.display_name AS player_name,
        e.outstanding_before_vnd,
        e.outstanding_after_vnd,
        e.metadata_json
      FROM module_history_events e
      LEFT JOIN players p ON p.id = e.player_id
      WHERE e.group_id = $1
        AND e.module = 'MATCH_STAKES'
        AND e.debt_period_id = $2
      ORDER BY e.posted_at ASC, e.created_at ASC, e.id ASC
      `,
      [input.groupId, input.periodId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      eventStatus: row.event_status,
      resetAt: row.reset_at,
      resetReason: row.reset_reason,
      postedAt: row.posted_at,
      createdAt: row.created_at,
      amountVnd: row.amount_vnd,
      note: row.note,
      impactMode: row.match_stakes_impact_mode,
      affectsDebt: row.affects_debt,
      playerId: row.player_id,
      playerName: row.player_name,
      outstandingBeforeVnd: row.outstanding_before_vnd,
      outstandingAfterVnd: row.outstanding_after_vnd,
      metadata: row.metadata_json
    }));
  }

  public async listMatchStakesPeriodEventImpacts(eventIds: string[]): Promise<MatchStakesPeriodHistoryImpactRecord[]> {
    if (eventIds.length === 0) {
      return [];
    }

    const result = await this.db.query<{
      history_event_id: string;
      player_id: string;
      player_name: string;
      net_delta_vnd: number;
    }>(
      `
      SELECT
        i.history_event_id,
        i.player_id,
        p.display_name AS player_name,
        i.net_delta_vnd
      FROM match_stakes_history_event_player_impacts i
      INNER JOIN module_history_events e ON e.id = i.history_event_id
      INNER JOIN players p ON p.id = i.player_id
      WHERE i.history_event_id = ANY($1::uuid[])
        AND e.module = 'MATCH_STAKES'
        AND e.event_type = 'MATCH_STAKES_ADVANCE'
        AND e.match_stakes_impact_mode = 'AFFECTS_DEBT'
        AND e.affects_debt = TRUE
        AND e.event_status = 'ACTIVE'
      ORDER BY i.created_at ASC, i.player_id ASC
      `,
      [eventIds]
    );

    return result.rows.map((row) => ({
      historyEventId: row.history_event_id,
      playerId: row.player_id,
      playerName: row.player_name,
      netDeltaVnd: row.net_delta_vnd
    }));
  }

  public async listMatchStakesHistory(input: {
    groupId: string;
    periodId?: string;
    playerId?: string;
    from?: string;
    to?: string;
    itemTypes?: string[];
    page: number;
    pageSize: number;
  }): Promise<{ items: UnifiedHistoryFeedItemRecord[]; total: number }> {
    const params: unknown[] = [input.groupId];
    const matchConditions: string[] = ["m.group_id = $1", "m.module = 'MATCH_STAKES'"];
    const settlementConditions: string[] = ["s.group_id = $1"];
    const eventConditions: string[] = ["e.group_id = $1", "e.module = 'MATCH_STAKES'"];

    if (input.from) {
      params.push(input.from);
      const ref = `$${params.length}`;
      matchConditions.push(`m.played_at >= ${ref}`);
      settlementConditions.push(`s.posted_at >= ${ref}`);
      eventConditions.push(`e.posted_at >= ${ref}`);
    }

    if (input.to) {
      params.push(input.to);
      const ref = `$${params.length}`;
      matchConditions.push(`m.played_at <= ${ref}`);
      settlementConditions.push(`s.posted_at <= ${ref}`);
      eventConditions.push(`e.posted_at <= ${ref}`);
    }

    if (input.periodId) {
      params.push(input.periodId);
      const ref = `$${params.length}`;
      matchConditions.push(`m.debt_period_id = ${ref}`);
      settlementConditions.push(`s.debt_period_id = ${ref}`);
      eventConditions.push(`e.debt_period_id = ${ref}`);
    }

    if (input.playerId) {
      params.push(input.playerId);
      const ref = `$${params.length}`;
      matchConditions.push(
        `EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.match_id = m.id AND mp2.player_id = ${ref})`
      );
      settlementConditions.push(
        `EXISTS (
          SELECT 1
          FROM match_stakes_debt_settlement_lines l2
          WHERE l2.settlement_id = s.id
            AND (l2.payer_player_id = ${ref} OR l2.receiver_player_id = ${ref})
        )`
      );
      eventConditions.push(
        `(
          e.player_id = ${ref}
          OR e.secondary_player_id = ${ref}
          OR EXISTS (
            SELECT 1
            FROM match_stakes_history_event_player_impacts i2
            WHERE i2.history_event_id = e.id
              AND i2.player_id = ${ref}
          )
        )`
      );
    }

    let itemTypeFilterSql = "";
    if (input.itemTypes && input.itemTypes.length > 0) {
      params.push(input.itemTypes);
      itemTypeFilterSql = `WHERE item_type = ANY($${params.length}::text[])`;
    }

    params.push(input.pageSize, (input.page - 1) * input.pageSize);

    const query = `
      WITH history_source AS (
        SELECT
          m.id::text AS id,
          m.module,
          'MATCH'::text AS item_type,
          NULL::history_event_type AS event_type,
          NULL::match_stakes_impact_mode AS match_stakes_impact_mode,
          NULL::boolean AS affects_debt,
          NULL::module_history_event_status AS event_status,
          NULL::timestamptz AS reset_at,
          NULL::text AS reset_reason,
          m.played_at AS posted_at,
          m.created_at AS created_at,
          CONCAT('Match #', COALESCE(m.period_match_no::text, '?')) AS title,
          rs.name AS description,
          ms.total_transfer_vnd AS amount_vnd,
          NULL::uuid AS player_id,
          NULL::text AS player_name,
          NULL::uuid AS secondary_player_id,
          NULL::text AS secondary_player_name,
          m.id AS match_id,
          m.debt_period_id,
          NULL::uuid AS ledger_batch_id,
          NULL::bigint AS balance_before_vnd,
          NULL::bigint AS balance_after_vnd,
          NULL::bigint AS outstanding_before_vnd,
          NULL::bigint AS outstanding_after_vnd,
          mn.note_text AS note,
          jsonb_build_object(
            'status', m.status,
            'participantCount', m.participant_count,
            'ruleSetId', m.rule_set_id,
            'ruleSetVersionId', m.rule_set_version_id,
            'debtPeriodNo', dp.period_no,
            'periodMatchNo', m.period_match_no,
            'totalFundInVnd', COALESCE(ms.total_fund_in_vnd, 0),
            'totalFundOutVnd', COALESCE(ms.total_fund_out_vnd, 0)
          ) AS metadata_json
        FROM matches m
        INNER JOIN rule_sets rs ON rs.id = m.rule_set_id
        LEFT JOIN match_settlements ms ON ms.match_id = m.id
        LEFT JOIN match_notes mn ON mn.match_id = m.id
        LEFT JOIN match_stakes_debt_periods dp ON dp.id = m.debt_period_id
        WHERE ${matchConditions.join(" AND ")}

        UNION ALL

        SELECT
          s.id::text AS id,
          'MATCH_STAKES'::module_type AS module,
          'DEBT_SETTLEMENT'::text AS item_type,
          NULL::history_event_type AS event_type,
          NULL::match_stakes_impact_mode AS match_stakes_impact_mode,
          NULL::boolean AS affects_debt,
          NULL::module_history_event_status AS event_status,
          NULL::timestamptz AS reset_at,
          NULL::text AS reset_reason,
          s.posted_at,
          s.created_at,
          'Debt settlement'::text AS title,
          s.note AS description,
          COALESCE(lines.total_amount_vnd, 0)::bigint AS amount_vnd,
          NULL::uuid AS player_id,
          NULL::text AS player_name,
          NULL::uuid AS secondary_player_id,
          NULL::text AS secondary_player_name,
          NULL::uuid AS match_id,
          s.debt_period_id,
          NULL::uuid AS ledger_batch_id,
          NULL::bigint AS balance_before_vnd,
          NULL::bigint AS balance_after_vnd,
          NULL::bigint AS outstanding_before_vnd,
          NULL::bigint AS outstanding_after_vnd,
          s.note,
          jsonb_build_object(
            'lineCount', COALESCE(lines.line_count, 0)
          ) AS metadata_json
        FROM match_stakes_debt_settlements s
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(l.amount_vnd), 0)::bigint AS total_amount_vnd,
            COUNT(*)::int AS line_count
          FROM match_stakes_debt_settlement_lines l
          WHERE l.settlement_id = s.id
        ) lines ON TRUE
        WHERE ${settlementConditions.join(" AND ")}

        UNION ALL

        SELECT
          e.id::text AS id,
          e.module,
          CASE
            WHEN e.event_type = 'MATCH_STAKES_ADVANCE' THEN 'ADVANCE'
            WHEN e.event_type = 'MATCH_STAKES_NOTE' THEN 'NOTE'
            ELSE 'NOTE'
          END::text AS item_type,
          e.event_type,
          e.match_stakes_impact_mode,
          e.affects_debt,
          e.event_status,
          e.reset_at,
          e.reset_reason,
          e.posted_at,
          e.created_at,
          CASE
            WHEN e.event_type = 'MATCH_STAKES_ADVANCE' THEN CONCAT('Advance by ', COALESCE(p.display_name, 'Unknown'))
            WHEN e.event_type = 'MATCH_STAKES_NOTE' THEN 'Operational note'
            ELSE 'Operational event'
          END::text AS title,
          e.note AS description,
          e.amount_vnd,
          e.player_id,
          p.display_name AS player_name,
          e.secondary_player_id,
          sp.display_name AS secondary_player_name,
          e.match_id,
          e.debt_period_id,
          e.ledger_batch_id,
          e.balance_before_vnd,
          e.balance_after_vnd,
          e.outstanding_before_vnd,
          e.outstanding_after_vnd,
          e.note,
          jsonb_build_object(
            'eventType', e.event_type,
            'affectsDebt', e.affects_debt,
            'impactMode', e.match_stakes_impact_mode,
            'eventStatus', e.event_status,
            'resetAt', e.reset_at,
            'resetReason', e.reset_reason,
            'details', e.metadata_json
          ) AS metadata_json
        FROM module_history_events e
        LEFT JOIN players p ON p.id = e.player_id
        LEFT JOIN players sp ON sp.id = e.secondary_player_id
        WHERE ${eventConditions.join(" AND ")}
      ),
      filtered AS (
        SELECT *
        FROM history_source
        ${itemTypeFilterSql}
      )
      SELECT
        id,
        module,
        item_type,
        event_type,
        match_stakes_impact_mode,
        affects_debt,
        event_status,
        reset_at,
        reset_reason,
        posted_at,
        created_at,
        title,
        description,
        amount_vnd,
        player_id,
        player_name,
        secondary_player_id,
        secondary_player_name,
        match_id,
        debt_period_id,
        ledger_batch_id,
        balance_before_vnd,
        balance_after_vnd,
        outstanding_before_vnd,
        outstanding_after_vnd,
        note,
        metadata_json,
        COUNT(*) OVER()::text AS total_count
      FROM filtered
      ORDER BY posted_at DESC, created_at DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await this.db.query<UnifiedHistoryFeedRow>(query, params);

    return {
      items: result.rows.map(mapUnifiedHistoryItem),
      total: Number(result.rows[0]?.total_count ?? "0")
    };
  }

  public async listGroupFundHistory(input: {
    groupId: string;
    playerId?: string;
    from?: string;
    to?: string;
    itemTypes?: string[];
    page: number;
    pageSize: number;
  }): Promise<{ items: UnifiedHistoryFeedItemRecord[]; total: number }> {
    const params: unknown[] = [input.groupId];
    const matchConditions: string[] = ["m.group_id = $1", "m.module = 'GROUP_FUND'"];
    const manualConditions: string[] = [
      "b.group_id = $1",
      "b.module = 'GROUP_FUND'",
      "b.source_type IN ('MANUAL_ADJUSTMENT', 'SYSTEM_CORRECTION')",
      "b.match_id IS NULL"
    ];
    const eventConditions: string[] = ["e.group_id = $1", "e.module = 'GROUP_FUND'"];

    if (input.from) {
      params.push(input.from);
      const ref = `$${params.length}`;
      matchConditions.push(`m.played_at >= ${ref}`);
      manualConditions.push(`b.posted_at >= ${ref}`);
      eventConditions.push(`e.posted_at >= ${ref}`);
    }

    if (input.to) {
      params.push(input.to);
      const ref = `$${params.length}`;
      matchConditions.push(`m.played_at <= ${ref}`);
      manualConditions.push(`b.posted_at <= ${ref}`);
      eventConditions.push(`e.posted_at <= ${ref}`);
    }

    if (input.playerId) {
      params.push(input.playerId);
      const ref = `$${params.length}`;
      matchConditions.push(
        `EXISTS (SELECT 1 FROM match_participants mp2 WHERE mp2.match_id = m.id AND mp2.player_id = ${ref})`
      );
      manualConditions.push(`(sa.player_id = ${ref} OR da.player_id = ${ref})`);
      eventConditions.push(`(e.player_id = ${ref} OR e.secondary_player_id = ${ref})`);
    }

    const transactionTypeCase = `
      CASE
        WHEN sa.account_type = 'PLAYER_FUND_OBLIGATION' AND da.account_type = 'FUND_MAIN' THEN 'CONTRIBUTION'
        WHEN sa.account_type = 'FUND_MAIN' AND da.account_type = 'PLAYER_FUND_OBLIGATION' THEN 'WITHDRAWAL'
        WHEN sa.account_type = 'SYSTEM_HOLDING' AND da.account_type = 'FUND_MAIN' THEN 'ADJUSTMENT_IN'
        WHEN sa.account_type = 'FUND_MAIN' AND da.account_type = 'SYSTEM_HOLDING' THEN 'ADJUSTMENT_OUT'
        ELSE NULL
      END
    `;

    manualConditions.push(`${transactionTypeCase} IS NOT NULL`);
    manualConditions.push(
      "NOT EXISTS (SELECT 1 FROM module_history_events eh WHERE eh.group_id = b.group_id AND eh.ledger_batch_id = b.id)"
    );

    let itemTypeFilterSql = "";
    if (input.itemTypes && input.itemTypes.length > 0) {
      params.push(input.itemTypes);
      itemTypeFilterSql = `WHERE item_type = ANY($${params.length}::text[])`;
    }

    params.push(input.pageSize, (input.page - 1) * input.pageSize);

    const query = `
      WITH history_source AS (
        SELECT
          m.id::text AS id,
          m.module,
          'MATCH'::text AS item_type,
          NULL::history_event_type AS event_type,
          NULL::match_stakes_impact_mode AS match_stakes_impact_mode,
          NULL::boolean AS affects_debt,
          NULL::module_history_event_status AS event_status,
          NULL::timestamptz AS reset_at,
          NULL::text AS reset_reason,
          m.played_at AS posted_at,
          m.created_at AS created_at,
          'Match settlement'::text AS title,
          rs.name AS description,
          (COALESCE(ms.total_fund_in_vnd, 0) - COALESCE(ms.total_fund_out_vnd, 0))::bigint AS amount_vnd,
          NULL::uuid AS player_id,
          NULL::text AS player_name,
          NULL::uuid AS secondary_player_id,
          NULL::text AS secondary_player_name,
          m.id AS match_id,
          NULL::uuid AS debt_period_id,
          NULL::uuid AS ledger_batch_id,
          NULL::bigint AS balance_before_vnd,
          NULL::bigint AS balance_after_vnd,
          NULL::bigint AS outstanding_before_vnd,
          NULL::bigint AS outstanding_after_vnd,
          mn.note_text AS note,
          jsonb_build_object(
            'status', m.status,
            'participantCount', m.participant_count,
            'ruleSetId', m.rule_set_id,
            'ruleSetVersionId', m.rule_set_version_id,
            'totalFundInVnd', COALESCE(ms.total_fund_in_vnd, 0),
            'totalFundOutVnd', COALESCE(ms.total_fund_out_vnd, 0),
            'totalTransferVnd', COALESCE(ms.total_transfer_vnd, 0)
          ) AS metadata_json
        FROM matches m
        INNER JOIN rule_sets rs ON rs.id = m.rule_set_id
        LEFT JOIN match_settlements ms ON ms.match_id = m.id
        LEFT JOIN match_notes mn ON mn.match_id = m.id
        WHERE ${matchConditions.join(" AND ")}

        UNION ALL

        SELECT
          e.id::text AS id,
          'GROUP_FUND'::module_type AS module,
          'MANUAL_TRANSACTION'::text AS item_type,
          NULL::history_event_type AS event_type,
          NULL::match_stakes_impact_mode AS match_stakes_impact_mode,
          NULL::boolean AS affects_debt,
          NULL::module_history_event_status AS event_status,
          NULL::timestamptz AS reset_at,
          NULL::text AS reset_reason,
          b.posted_at,
          e.created_at,
          CASE ${transactionTypeCase}
            WHEN 'CONTRIBUTION' THEN 'Manual contribution'
            WHEN 'WITHDRAWAL' THEN 'Manual withdrawal'
            WHEN 'ADJUSTMENT_IN' THEN 'Manual adjustment in'
            WHEN 'ADJUSTMENT_OUT' THEN 'Manual adjustment out'
            ELSE 'Manual transaction'
          END::text AS title,
          e.entry_reason AS description,
          e.amount_vnd,
          COALESCE(sa.player_id, da.player_id) AS player_id,
          COALESCE(sp.display_name, dp.display_name) AS player_name,
          NULL::uuid AS secondary_player_id,
          NULL::text AS secondary_player_name,
          NULL::uuid AS match_id,
          NULL::uuid AS debt_period_id,
          b.id AS ledger_batch_id,
          NULL::bigint AS balance_before_vnd,
          NULL::bigint AS balance_after_vnd,
          NULL::bigint AS outstanding_before_vnd,
          NULL::bigint AS outstanding_after_vnd,
          e.entry_reason AS note,
          jsonb_build_object(
            'sourceType', b.source_type,
            'transactionType', ${transactionTypeCase},
            'entryId', e.id
          ) AS metadata_json
        FROM ledger_entries e
        INNER JOIN ledger_entry_batches b ON b.id = e.batch_id
        INNER JOIN ledger_accounts sa ON sa.id = e.source_account_id
        INNER JOIN ledger_accounts da ON da.id = e.destination_account_id
        LEFT JOIN players sp ON sp.id = sa.player_id
        LEFT JOIN players dp ON dp.id = da.player_id
        WHERE ${manualConditions.join(" AND ")}

        UNION ALL

        SELECT
          e.id::text AS id,
          e.module,
          CASE
            WHEN e.event_type = 'GROUP_FUND_ADVANCE' THEN 'ADVANCE'
            WHEN e.event_type = 'GROUP_FUND_NOTE' THEN 'NOTE'
            WHEN e.event_type = 'GROUP_FUND_ADJUSTMENT' THEN 'ADJUSTMENT'
            WHEN e.event_type = 'GROUP_FUND_CONTRIBUTION' THEN 'CONTRIBUTION'
            ELSE 'NOTE'
          END::text AS item_type,
          e.event_type,
          NULL::match_stakes_impact_mode AS match_stakes_impact_mode,
          NULL::boolean AS affects_debt,
          e.event_status,
          e.reset_at,
          e.reset_reason,
          e.posted_at,
          e.created_at,
          CASE
            WHEN e.event_type = 'GROUP_FUND_ADVANCE' THEN CONCAT('Fund advanced by ', COALESCE(p.display_name, 'Unknown'))
            WHEN e.event_type = 'GROUP_FUND_NOTE' THEN 'Fund note'
            WHEN e.event_type = 'GROUP_FUND_ADJUSTMENT' THEN 'Fund adjustment'
            WHEN e.event_type = 'GROUP_FUND_CONTRIBUTION' THEN CONCAT('Fund contribution by ', COALESCE(p.display_name, 'Unknown'))
            ELSE 'Fund event'
          END::text AS title,
          e.note AS description,
          e.amount_vnd,
          e.player_id,
          p.display_name AS player_name,
          e.secondary_player_id,
          sp.display_name AS secondary_player_name,
          e.match_id,
          e.debt_period_id,
          e.ledger_batch_id,
          e.balance_before_vnd,
          e.balance_after_vnd,
          e.outstanding_before_vnd,
          e.outstanding_after_vnd,
          e.note,
          jsonb_build_object(
            'eventType', e.event_type,
            'eventStatus', e.event_status,
            'resetAt', e.reset_at,
            'resetReason', e.reset_reason,
            'details', e.metadata_json
          ) AS metadata_json
        FROM module_history_events e
        LEFT JOIN players p ON p.id = e.player_id
        LEFT JOIN players sp ON sp.id = e.secondary_player_id
        WHERE ${eventConditions.join(" AND ")}
      ),
      filtered AS (
        SELECT *
        FROM history_source
        ${itemTypeFilterSql}
      )
      SELECT
        id,
        module,
        item_type,
        event_type,
        match_stakes_impact_mode,
        affects_debt,
        event_status,
        reset_at,
        reset_reason,
        posted_at,
        created_at,
        title,
        description,
        amount_vnd,
        player_id,
        player_name,
        secondary_player_id,
        secondary_player_name,
        match_id,
        debt_period_id,
        ledger_batch_id,
        balance_before_vnd,
        balance_after_vnd,
        outstanding_before_vnd,
        outstanding_after_vnd,
        note,
        metadata_json,
        COUNT(*) OVER()::text AS total_count
      FROM filtered
      ORDER BY posted_at DESC, created_at DESC, id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await this.db.query<UnifiedHistoryFeedRow>(query, params);

    return {
      items: result.rows.map(mapUnifiedHistoryItem),
      total: Number(result.rows[0]?.total_count ?? "0")
    };
  }

  public async summarizeGroupFundEvents(
    groupId: string,
    from?: string,
    to?: string
  ): Promise<{
    totalAdvanceVnd: number;
    totalContributionVnd: number;
    advancesByPlayer: Array<{
      playerId: string;
      playerName: string;
      totalAdvancedVnd: number;
      lastAdvancedAt: string;
    }>;
  }> {
    const params: unknown[] = [groupId];
    const conditions: string[] = [
      "e.group_id = $1",
      "e.module = 'GROUP_FUND'",
      "e.event_status = 'ACTIVE'",
      "e.event_type IN ('GROUP_FUND_ADVANCE', 'GROUP_FUND_CONTRIBUTION')"
    ];

    if (from) {
      params.push(from);
      conditions.push(`e.posted_at >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      conditions.push(`e.posted_at <= $${params.length}`);
    }

    const result = await this.db.query<{
      event_type: HistoryEventType;
      player_id: string | null;
      player_name: string | null;
      total_amount_vnd: number;
      last_posted_at: string;
    }>(
      `
      SELECT
        e.event_type,
        e.player_id,
        p.display_name AS player_name,
        COALESCE(SUM(e.amount_vnd), 0)::bigint AS total_amount_vnd,
        MAX(e.posted_at) AS last_posted_at
      FROM module_history_events e
      LEFT JOIN players p ON p.id = e.player_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY e.event_type, e.player_id, p.display_name
      `,
      params
    );

    let totalAdvanceVnd = 0;
    let totalContributionVnd = 0;
    const advancesByPlayer: Array<{
      playerId: string;
      playerName: string;
      totalAdvancedVnd: number;
      lastAdvancedAt: string;
    }> = [];

    for (const row of result.rows) {
      if (row.event_type === "GROUP_FUND_ADVANCE") {
        totalAdvanceVnd += row.total_amount_vnd;
        if (row.player_id) {
          advancesByPlayer.push({
            playerId: row.player_id,
            playerName: row.player_name ?? row.player_id,
            totalAdvancedVnd: row.total_amount_vnd,
            lastAdvancedAt: row.last_posted_at
          });
        }
      } else if (row.event_type === "GROUP_FUND_CONTRIBUTION") {
        totalContributionVnd += row.total_amount_vnd;
      }
    }

    advancesByPlayer.sort((left, right) => {
      if (left.totalAdvancedVnd !== right.totalAdvancedVnd) {
        return right.totalAdvancedVnd - left.totalAdvancedVnd;
      }
      return left.playerName.localeCompare(right.playerName);
    });

    return {
      totalAdvanceVnd,
      totalContributionVnd,
      advancesByPlayer
    };
  }
}
