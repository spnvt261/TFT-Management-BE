import type { Pool } from "pg";
import { badRequest, notFound, unprocessable } from "../../core/errors/app-error.js";
import { withTransaction } from "../../db/postgres/transaction.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { RuleEngineService } from "../../domain/services/rule-engine/rule-engine.service.js";
import { LedgerPostingService } from "../../domain/services/ledger-posting/ledger-posting.service.js";
import type { MatchStatus, ModuleType } from "../../domain/models/enums.js";
import { AccountResolutionHelper } from "../../db/repositories/account-resolution-helper.js";
import { AccountRepository } from "../../db/repositories/account-repository.js";

export interface CreateMatchInput {
  module: ModuleType;
  playedAt?: string;
  ruleSetId: string;
  ruleSetVersionId?: string;
  note?: string | null;
  participants: Array<{
    playerId: string;
    tftPlacement: number;
  }>;
}

export class MatchService {
  public constructor(
    private readonly pool: Pool,
    private readonly repositories: RepositoryBundle,
    private readonly groupId: string
  ) {}

  public async createMatch(input: CreateMatchInput) {
    this.validateParticipants(input.participants);
    const playedAt = input.playedAt ?? new Date().toISOString();

    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);

      const playerIds = input.participants.map((item) => item.playerId);
      const activePlayers = await txRepositories.players.findActiveByIds(this.groupId, playerIds);
      if (activePlayers.length !== input.participants.length) {
        throw unprocessable("MATCH_PLAYERS_INVALID", "One or more participants are inactive or not in the group");
      }

      const ruleSet = await txRepositories.rules.getRuleSetById(this.groupId, input.ruleSetId);
      if (!ruleSet) {
        throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
      }

      if (ruleSet.module !== input.module) {
        throw unprocessable("MATCH_RULE_SET_MODULE_MISMATCH", "Rule set module does not match request module");
      }

      const ruleVersion = await txRepositories.rules.resolveVersionForMatch({
        ruleSetId: input.ruleSetId,
        module: input.module,
        participantCount: input.participants.length,
        playedAt,
        versionId: input.ruleSetVersionId
      });

      if (!ruleVersion) {
        throw unprocessable(
          "RULE_SET_VERSION_NOT_APPLICABLE",
          "No applicable rule set version for participant count/effective window"
        );
      }

      const accountResolutionHelper = new AccountResolutionHelper(new AccountRepository(tx));
      const ruleEngine = new RuleEngineService(accountResolutionHelper);
      const ledgerPosting = new LedgerPostingService();

      const context = RuleEngineService.buildContext({
        groupId: this.groupId,
        module: input.module,
        participantCount: input.participants.length,
        playedAt,
        participants: input.participants,
        version: ruleVersion
      });

      const evaluated = await ruleEngine.evaluate(context);
      const postingPlan = ledgerPosting.buildPostingPlan(evaluated.lines);

      const match = await txRepositories.matches.createMatch({
        groupId: this.groupId,
        module: input.module,
        ruleSetId: input.ruleSetId,
        ruleSetVersionId: ruleVersion.id,
        playedAt,
        participantCount: input.participants.length,
        status: "POSTED",
        inputSnapshot: {
          ...input,
          playedAt
        },
        calculationSnapshot: {
          ruleVersionId: ruleVersion.id,
          summary: evaluated.summary
        }
      });

      const participantRows = context.participants.map((participant) => ({
        playerId: participant.playerId,
        tftPlacement: participant.tftPlacement,
        relativeRank: participant.relativeRank,
        isWinnerAmongParticipants: participant.relativeRank === 1,
        settlementNetVnd: evaluated.summary.netByPlayer[participant.playerId] ?? 0
      }));

      await txRepositories.matches.insertParticipants(match.id, participantRows);

      if (input.note && input.note.trim().length > 0) {
        await txRepositories.matches.upsertNote(match.id, input.note.trim());
      }

      const settlement = await txRepositories.settlements.createSettlement({
        matchId: match.id,
        module: input.module,
        totalTransferVnd: evaluated.summary.totalTransferVnd,
        totalFundInVnd: evaluated.summary.totalFundInVnd,
        totalFundOutVnd: evaluated.summary.totalFundOutVnd,
        engineVersion: "v1",
        ruleSnapshot: {
          ruleSet,
          ruleVersion
        },
        resultSnapshot: {
          lines: evaluated.lines,
          summary: evaluated.summary
        }
      });

      await txRepositories.settlements.insertSettlementLines(match.id, settlement.id, evaluated.lines);

      const batch = await txRepositories.ledgers.createBatch({
        groupId: this.groupId,
        module: input.module,
        sourceType: "MATCH_SETTLEMENT",
        matchId: match.id,
        description: `Match settlement for ${match.id}`,
        referenceCode: match.id
      });

      const settlementLineIds = await txRepositories.ledgers.getInsertedSettlementLineIds(settlement.id);
      await txRepositories.ledgers.insertEntries(batch.id, settlementLineIds, postingPlan);

      await txRepositories.presets.upsert({
        groupId: this.groupId,
        module: input.module,
        lastRuleSetId: input.ruleSetId,
        lastRuleSetVersionId: ruleVersion.id,
        lastSelectedPlayerIds: input.participants.map((participant) => participant.playerId),
        lastParticipantCount: input.participants.length,
        lastUsedAt: playedAt
      });

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "MATCH",
        entityId: match.id,
        actionType: "CREATE",
        after: {
          input,
          ruleSetId: input.ruleSetId,
          ruleSetVersionId: ruleVersion.id,
          settlementSummary: evaluated.summary
        }
      });

      return this.getMatchDetail(match.id);
    });
  }

  public async listMatches(input: {
    module?: ModuleType;
    status?: MatchStatus;
    playerId?: string;
    ruleSetId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }) {
    const list = await this.repositories.matches.list({
      groupId: this.groupId,
      module: input.module,
      status: input.status,
      playerId: input.playerId,
      ruleSetId: input.ruleSetId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });

    const items = await Promise.all(
      list.items.map(async (match) => {
        const [participants, settlement, ruleSet, note] = await Promise.all([
          this.repositories.matches.getParticipants(match.id),
          this.repositories.settlements.getSettlementWithLines(match.id),
          this.repositories.rules.getRuleSetById(this.groupId, match.rule_set_id),
          this.repositories.matches.getNote(match.id)
        ]);

        return {
          id: match.id,
          module: match.module,
          playedAt: match.played_at,
          participantCount: match.participant_count,
          ruleSetId: match.rule_set_id,
          ruleSetName: ruleSet?.name ?? "Unknown",
          ruleSetVersionId: match.rule_set_version_id,
          ruleSetVersionNo: match.rule_set_version_no ?? 1,
          notePreview: note ? note.slice(0, 120) : null,
          status: match.status,
          participants,
          totalTransferVnd: settlement?.totalTransferVnd ?? 0,
          totalFundInVnd: settlement?.totalFundInVnd ?? 0,
          totalFundOutVnd: settlement?.totalFundOutVnd ?? 0,
          createdAt: match.created_at
        };
      })
    );

    return {
      items,
      total: list.total
    };
  }

  public async getMatchDetail(matchId: string) {
    const match = await this.repositories.matches.findById(this.groupId, matchId);
    if (!match) {
      throw notFound("MATCH_NOT_FOUND", "Match not found");
    }

    const [participants, note, settlement, ruleSet, ruleVersion] = await Promise.all([
      this.repositories.matches.getParticipants(matchId),
      this.repositories.matches.getNote(matchId),
      this.repositories.settlements.getSettlementWithLines(matchId),
      this.repositories.rules.getRuleSetById(this.groupId, match.rule_set_id),
      this.repositories.rules.getRuleSetVersionDetail(match.rule_set_id, match.rule_set_version_id)
    ]);

    return {
      id: match.id,
      module: match.module,
      playedAt: match.played_at,
      participantCount: match.participant_count,
      status: match.status,
      note,
      ruleSet: {
        id: ruleSet?.id ?? match.rule_set_id,
        name: ruleSet?.name ?? "Unknown",
        module: (ruleSet?.module ?? match.module) as ModuleType
      },
      ruleSetVersion: ruleVersion
        ? {
            id: ruleVersion.id,
            versionNo: ruleVersion.versionNo,
            participantCountMin: ruleVersion.participantCountMin,
            participantCountMax: ruleVersion.participantCountMax,
            effectiveFrom: ruleVersion.effectiveFrom,
            effectiveTo: ruleVersion.effectiveTo
          }
        : null,
      participants,
      settlement,
      voidReason: match.void_reason,
      voidedAt: match.voided_at,
      createdAt: match.created_at,
      updatedAt: match.updated_at
    };
  }

  public async voidMatch(matchId: string, reason: string) {
    if (reason.trim().length < 3) {
      throw badRequest("MATCH_VOID_REASON_INVALID", "Void reason must be at least 3 characters");
    }

    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const match = await txRepositories.matches.findById(this.groupId, matchId);
      if (!match) {
        throw notFound("MATCH_NOT_FOUND", "Match not found");
      }

      if (match.status === "VOIDED") {
        throw unprocessable("MATCH_ALREADY_VOIDED", "Match is already voided");
      }

      const originalEntries = await txRepositories.ledgers.getEntriesByMatch(matchId);

      const reversalBatch = await txRepositories.ledgers.createBatch({
        groupId: this.groupId,
        module: match.module,
        sourceType: "MATCH_VOID_REVERSAL",
        matchId,
        description: `Void reversal for match ${matchId}`,
        referenceCode: `${matchId}:VOID`
      });

      const reversalEntries = originalEntries.map((entry, index) => ({
        sourceAccountId: entry.destinationAccountId,
        destinationAccountId: entry.sourceAccountId,
        amountVnd: entry.amountVnd,
        reasonText: `REVERSAL: ${entry.reasonText}`,
        lineNo: index + 1
      }));

      await txRepositories.ledgers.insertEntries(reversalBatch.id, [], reversalEntries);
      await txRepositories.matches.voidMatch(matchId, reason.trim());

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "MATCH",
        entityId: matchId,
        actionType: "VOID",
        before: { status: match.status },
        after: { status: "VOIDED", reason: reason.trim() }
      });

      return {
        id: matchId,
        status: "VOIDED" as const,
        reason: reason.trim(),
        voidedAt: new Date().toISOString()
      };
    });
  }

  private validateParticipants(participants: Array<{ playerId: string; tftPlacement: number }>): void {
    if (participants.length !== 3 && participants.length !== 4) {
      throw badRequest("MATCH_PARTICIPANT_COUNT_INVALID", "Participants must contain 3 or 4 players");
    }

    const playerIds = participants.map((item) => item.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      throw badRequest("MATCH_DUPLICATE_PLAYER", "Player IDs must be unique");
    }

    const placements = participants.map((item) => item.tftPlacement);
    if (new Set(placements).size !== placements.length) {
      throw badRequest("MATCH_DUPLICATE_PLACEMENT", "TFT placements must be unique");
    }

    for (const placement of placements) {
      if (!Number.isInteger(placement) || placement < 1 || placement > 8) {
        throw badRequest("MATCH_PLACEMENT_INVALID", "Each tftPlacement must be an integer in range 1..8");
      }
    }
  }
}
