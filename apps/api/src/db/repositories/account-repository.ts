import type { Queryable } from "../postgres/transaction.js";
import type { AccountType, ModuleType } from "../../domain/models/enums.js";

export interface ResolvedAccount {
  accountId: string;
  playerId: string | null;
}

export class AccountRepository {
  public constructor(private readonly db: Queryable) {}

  public async getOrCreateFundAccount(groupId: string): Promise<ResolvedAccount> {
    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM ledger_accounts WHERE group_id = $1 AND account_type = 'FUND_MAIN' AND player_id IS NULL LIMIT 1`,
      [groupId]
    );

    if (existing.rows[0]) {
      return { accountId: existing.rows[0].id, playerId: null };
    }

    const created = await this.db.query<{ id: string }>(
      `
      INSERT INTO ledger_accounts(group_id, account_type, player_id, name)
      VALUES ($1, 'FUND_MAIN', NULL, 'Group Fund Main')
      RETURNING id
      `,
      [groupId]
    );

    return { accountId: created.rows[0]!.id, playerId: null };
  }

  public async getOrCreateSystemAccount(groupId: string): Promise<ResolvedAccount> {
    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM ledger_accounts WHERE group_id = $1 AND account_type = 'SYSTEM_HOLDING' AND player_id IS NULL LIMIT 1`,
      [groupId]
    );

    if (existing.rows[0]) {
      return { accountId: existing.rows[0].id, playerId: null };
    }

    const created = await this.db.query<{ id: string }>(
      `
      INSERT INTO ledger_accounts(group_id, account_type, player_id, name)
      VALUES ($1, 'SYSTEM_HOLDING', NULL, 'System Holding')
      RETURNING id
      `,
      [groupId]
    );

    return { accountId: created.rows[0]!.id, playerId: null };
  }

  public async getOrCreatePlayerAccount(groupId: string, playerId: string, module: ModuleType): Promise<ResolvedAccount> {
    const accountType: AccountType = module === "MATCH_STAKES" ? "PLAYER_DEBT" : "PLAYER_FUND_OBLIGATION";

    const existing = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM ledger_accounts
      WHERE group_id = $1 AND account_type = $2 AND player_id = $3
      LIMIT 1
      `,
      [groupId, accountType, playerId]
    );

    if (existing.rows[0]) {
      return { accountId: existing.rows[0].id, playerId };
    }

    const playerResult = await this.db.query<{ display_name: string }>(`SELECT display_name FROM players WHERE id = $1`, [playerId]);
    const displayName = playerResult.rows[0]?.display_name ?? playerId;

    const created = await this.db.query<{ id: string }>(
      `
      INSERT INTO ledger_accounts(group_id, account_type, player_id, name)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [groupId, accountType, playerId, `${displayName} ${accountType}`]
    );

    return { accountId: created.rows[0]!.id, playerId };
  }
}
