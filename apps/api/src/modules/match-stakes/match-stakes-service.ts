import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";

export class MatchStakesService {
  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

  public async getSummary(input: { from?: string; to?: string }) {
    const players = await this.repositories.ledgers.getMatchStakesSummary(this.groupId, input.from, input.to);
    const matches = await this.repositories.matches.list({
      groupId: this.groupId,
      module: "MATCH_STAKES",
      from: input.from,
      to: input.to,
      page: 1,
      pageSize: 1
    });

    return {
      module: "MATCH_STAKES" as const,
      players,
      debtSuggestions: [],
      totalMatches: matches.total,
      range: {
        from: input.from ?? null,
        to: input.to ?? null
      }
    };
  }

  public async getLedger(input: { playerId?: string; from?: string; to?: string; page: number; pageSize: number }) {
    return this.repositories.ledgers.listLedgerByModule({
      groupId: this.groupId,
      module: "MATCH_STAKES",
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
      module: "MATCH_STAKES",
      playerId: input.playerId,
      ruleSetId: input.ruleSetId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });
  }
}
