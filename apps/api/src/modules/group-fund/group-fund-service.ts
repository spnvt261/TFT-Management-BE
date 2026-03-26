import type { Pool } from "pg";
import { badRequest, unprocessable } from "../../core/errors/app-error.js";
import { withTransaction } from "../../db/postgres/transaction.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
import type { GroupFundTransactionType } from "../../db/repositories/ledger-repository.js";

type LedgerSourceType = "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION";

export class GroupFundService {
  public constructor(
    private readonly pool: Pool,
    private readonly repositories: RepositoryBundle,
    private readonly groupId: string
  ) {}

  public async getSummary(input: { from?: string; to?: string }) {
    const summary = await this.repositories.ledgers.getGroupFundSummary(this.groupId, input.from, input.to);
    const matches = await this.repositories.matches.list({
      groupId: this.groupId,
      module: "GROUP_FUND",
      from: input.from,
      to: input.to,
      page: 1,
      pageSize: 1
    });

    return {
      module: "GROUP_FUND" as const,
      fundBalanceVnd: summary.fundBalanceVnd,
      totalMatches: matches.total,
      players: summary.players,
      range: {
        from: input.from ?? null,
        to: input.to ?? null
      }
    };
  }

  public getLedger(input: { playerId?: string; from?: string; to?: string; page: number; pageSize: number }) {
    return this.repositories.ledgers.listLedgerByModule({
      groupId: this.groupId,
      module: "GROUP_FUND",
      playerId: input.playerId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  public getMatches(input: {
    playerId?: string;
    ruleSetId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }) {
    return this.repositories.matches.list({
      groupId: this.groupId,
      module: "GROUP_FUND",
      playerId: input.playerId,
      ruleSetId: input.ruleSetId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  public async markContributionPaid(input: {
    playerId: string;
    amountVnd: number;
    note?: string | null;
    postedAt?: string;
  }) {
    const normalizedNote = input.note?.trim() ?? "";
    const reason = normalizedNote.length > 0 ? normalizedNote : "Marked player paid into group fund";

    const created = await this.createManualTransaction({
      transactionType: "WITHDRAWAL",
      playerId: input.playerId,
      amountVnd: input.amountVnd,
      reason,
      postedAt: input.postedAt
    });

    return {
      batchId: created.batchId,
      postedAt: created.postedAt,
      playerId: created.playerId ?? input.playerId,
      playerName: created.playerName ?? input.playerId,
      amountVnd: created.amountVnd,
      note: normalizedNote.length > 0 ? normalizedNote : null
    };
  }

  public async createManualTransaction(input: {
    transactionType: GroupFundTransactionType;
    playerId?: string | null;
    amountVnd: number;
    reason: string;
    postedAt?: string;
  }) {
    const needsPlayer = input.transactionType === "CONTRIBUTION" || input.transactionType === "WITHDRAWAL";
    const playerId = input.playerId ?? null;

    if (needsPlayer && !playerId) {
      throw badRequest("GROUP_FUND_PLAYER_REQUIRED", "playerId is required for CONTRIBUTION and WITHDRAWAL");
    }

    if (!needsPlayer && playerId) {
      throw badRequest("GROUP_FUND_PLAYER_NOT_ALLOWED", "playerId must be null for ADJUSTMENT_IN and ADJUSTMENT_OUT");
    }

    const reason = input.reason.trim();
    const postedAt = input.postedAt ?? new Date().toISOString();

    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      let playerName: string | null = null;

      if (playerId) {
        const activePlayers = await txRepositories.players.findActiveByIds(this.groupId, [playerId]);
        if (activePlayers.length !== 1) {
          throw unprocessable("GROUP_FUND_PLAYER_INVALID", "playerId must be an active member of the current group");
        }
        playerName = activePlayers[0]!.displayName;
      }

      const fundAccount = await txRepositories.accounts.getOrCreateFundAccount(this.groupId);

      let sourceAccountId: string;
      let destinationAccountId: string;
      let sourceType: LedgerSourceType;

      switch (input.transactionType) {
        case "CONTRIBUTION": {
          const playerAccount = await txRepositories.accounts.getOrCreatePlayerAccount(this.groupId, playerId!, "GROUP_FUND");
          sourceAccountId = playerAccount.accountId;
          destinationAccountId = fundAccount.accountId;
          sourceType = "MANUAL_ADJUSTMENT";
          break;
        }
        case "WITHDRAWAL": {
          const playerAccount = await txRepositories.accounts.getOrCreatePlayerAccount(this.groupId, playerId!, "GROUP_FUND");
          sourceAccountId = fundAccount.accountId;
          destinationAccountId = playerAccount.accountId;
          sourceType = "MANUAL_ADJUSTMENT";
          break;
        }
        case "ADJUSTMENT_IN": {
          const systemAccount = await txRepositories.accounts.getOrCreateSystemAccount(this.groupId);
          sourceAccountId = systemAccount.accountId;
          destinationAccountId = fundAccount.accountId;
          sourceType = "SYSTEM_CORRECTION";
          break;
        }
        case "ADJUSTMENT_OUT": {
          const systemAccount = await txRepositories.accounts.getOrCreateSystemAccount(this.groupId);
          sourceAccountId = fundAccount.accountId;
          destinationAccountId = systemAccount.accountId;
          sourceType = "SYSTEM_CORRECTION";
          break;
        }
      }

      const batch = await txRepositories.ledgers.createBatch({
        groupId: this.groupId,
        module: "GROUP_FUND",
        sourceType,
        matchId: null,
        description: `Manual ${input.transactionType.toLowerCase()}: ${reason}`,
        referenceCode: null,
        postedAt
      });

      await txRepositories.ledgers.insertEntries(batch.id, [], [
        {
          sourceAccountId,
          destinationAccountId,
          amountVnd: input.amountVnd,
          reasonText: reason,
          lineNo: 1
        }
      ]);

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "GROUP_FUND_TRANSACTION",
        entityId: batch.id,
        actionType: "CREATE",
        after: {
          transactionType: input.transactionType,
          playerId,
          amountVnd: input.amountVnd,
          reason,
          postedAt,
          sourceType
        }
      });

      return {
        batchId: batch.id,
        transactionType: input.transactionType,
        playerId,
        playerName,
        amountVnd: input.amountVnd,
        reason,
        postedAt,
        sourceType
      };
    });
  }

  public async listManualTransactions(input: {
    transactionType?: GroupFundTransactionType;
    playerId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }) {
    const result = await this.repositories.ledgers.listManualGroupFundTransactions({
      groupId: this.groupId,
      transactionType: input.transactionType,
      playerId: input.playerId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });

    return {
      items: result.items.map((item) => ({
        entryId: item.entry_id,
        batchId: item.batch_id,
        postedAt: item.posted_at,
        sourceType: item.source_type,
        transactionType: item.transaction_type,
        playerId: item.player_id,
        playerName: item.player_name,
        amountVnd: item.amount_vnd,
        reason: item.entry_reason
      })),
      total: result.total
    };
  }
}
