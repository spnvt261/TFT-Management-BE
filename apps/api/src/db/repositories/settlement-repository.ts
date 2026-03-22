import type { Queryable } from "../postgres/transaction.js";
import type { ModuleType } from "../../domain/models/enums.js";
import type { SettlementLineDraft } from "../../domain/models/records.js";

export interface SettlementInsertInput {
  matchId: string;
  module: ModuleType;
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  engineVersion: string;
  ruleSnapshot: unknown;
  resultSnapshot: unknown;
}

export class SettlementRepository {
  public constructor(private readonly db: Queryable) {}

  public async createSettlement(input: SettlementInsertInput): Promise<{ id: string }> {
    const result = await this.db.query<{ id: string }>(
      `
      INSERT INTO match_settlements(
        match_id, module, total_transfer_vnd, total_fund_in_vnd, total_fund_out_vnd,
        engine_version, rule_snapshot_json, result_snapshot_json, posted_to_ledger_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      RETURNING id
      `,
      [
        input.matchId,
        input.module,
        input.totalTransferVnd,
        input.totalFundInVnd,
        input.totalFundOutVnd,
        input.engineVersion,
        input.ruleSnapshot,
        input.resultSnapshot
      ]
    );

    return { id: result.rows[0]!.id };
  }

  public async insertSettlementLines(matchId: string, settlementId: string, lines: SettlementLineDraft[]): Promise<void> {
    let lineNo = 1;
    for (const line of lines) {
      await this.db.query(
        `
        INSERT INTO match_settlement_lines(
          match_settlement_id, match_id, line_no, rule_id, rule_code, rule_name,
          source_account_id, destination_account_id, source_player_id, destination_player_id,
          amount_vnd, reason_text, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          settlementId,
          matchId,
          lineNo,
          line.ruleId,
          line.ruleCode,
          line.ruleName,
          line.sourceAccountId,
          line.destinationAccountId,
          line.sourcePlayerId,
          line.destinationPlayerId,
          line.amountVnd,
          line.reasonText,
          line.metadataJson
        ]
      );
      lineNo += 1;
    }
  }

  public async getSettlementWithLines(matchId: string): Promise<
    | {
        id: string;
        totalTransferVnd: number;
        totalFundInVnd: number;
        totalFundOutVnd: number;
        engineVersion: string;
        ruleSnapshot: unknown;
        resultSnapshot: unknown;
        postedToLedgerAt: string | null;
        lines: Array<{
          id: string;
          lineNo: number;
          ruleId: string | null;
          ruleCode: string;
          ruleName: string;
          sourceAccountId: string;
          destinationAccountId: string;
          sourcePlayerId: string | null;
          destinationPlayerId: string | null;
          amountVnd: number;
          reasonText: string;
          metadata: unknown;
        }>;
      }
    | null
  > {
    const settlementResult = await this.db.query<{
      id: string;
      total_transfer_vnd: number;
      total_fund_in_vnd: number;
      total_fund_out_vnd: number;
      engine_version: string;
      rule_snapshot_json: unknown;
      result_snapshot_json: unknown;
      posted_to_ledger_at: string | null;
    }>(
      `
      SELECT id, total_transfer_vnd, total_fund_in_vnd, total_fund_out_vnd, engine_version,
             rule_snapshot_json, result_snapshot_json, posted_to_ledger_at
      FROM match_settlements
      WHERE match_id = $1
      LIMIT 1
      `,
      [matchId]
    );

    const settlementRow = settlementResult.rows[0];
    if (!settlementRow) {
      return null;
    }

    const linesResult = await this.db.query<{
      id: string;
      line_no: number;
      rule_id: string | null;
      rule_code: string;
      rule_name: string;
      source_account_id: string;
      destination_account_id: string;
      source_player_id: string | null;
      destination_player_id: string | null;
      amount_vnd: number;
      reason_text: string;
      metadata_json: unknown;
    }>(
      `
      SELECT id, line_no, rule_id, rule_code, rule_name, source_account_id, destination_account_id,
             source_player_id, destination_player_id, amount_vnd, reason_text, metadata_json
      FROM match_settlement_lines
      WHERE match_settlement_id = $1
      ORDER BY line_no ASC
      `,
      [settlementRow.id]
    );

    return {
      id: settlementRow.id,
      totalTransferVnd: settlementRow.total_transfer_vnd,
      totalFundInVnd: settlementRow.total_fund_in_vnd,
      totalFundOutVnd: settlementRow.total_fund_out_vnd,
      engineVersion: settlementRow.engine_version,
      ruleSnapshot: settlementRow.rule_snapshot_json,
      resultSnapshot: settlementRow.result_snapshot_json,
      postedToLedgerAt: settlementRow.posted_to_ledger_at,
      lines: linesResult.rows.map((row) => ({
        id: row.id,
        lineNo: row.line_no,
        ruleId: row.rule_id,
        ruleCode: row.rule_code,
        ruleName: row.rule_name,
        sourceAccountId: row.source_account_id,
        destinationAccountId: row.destination_account_id,
        sourcePlayerId: row.source_player_id,
        destinationPlayerId: row.destination_player_id,
        amountVnd: row.amount_vnd,
        reasonText: row.reason_text,
        metadata: row.metadata_json
      }))
    };
  }
}
