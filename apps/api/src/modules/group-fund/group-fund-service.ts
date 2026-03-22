import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";

export class GroupFundService {
  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

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
}
