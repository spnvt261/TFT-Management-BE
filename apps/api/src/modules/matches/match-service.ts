import type { Pool } from "pg";
import { badRequest, notFound, unprocessable } from "../../core/errors/app-error.js";
import { withTransaction } from "../../db/postgres/transaction.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { LedgerPostingService } from "../../domain/services/ledger-posting/ledger-posting.service.js";
import type { MatchStatus, ModuleType } from "../../domain/models/enums.js";
import type { EvaluatedSettlement } from "../../domain/services/rule-engine/rule-engine.service.js";
import type { SettlementLineDraft } from "../../domain/models/records.js";
import {
  MatchCalculationService,
  MATCH_ENGINE_VERSION,
  type MatchConfirmationInput,
  type MatchConfirmationMode,
  type MatchParticipantInput
} from "./match-calculation.service.js";

export interface PreviewMatchInput {
  module: ModuleType;
  playedAt?: string;
  ruleSetId: string;
  note?: string | null;
  participants: MatchParticipantInput[];
}

export interface CreateMatchInput {
  module: ModuleType;
  playedAt?: string;
  ruleSetId: string;
  ruleSetVersionId: string;
  note?: string | null;
  participants: MatchParticipantInput[];
  confirmation?: MatchConfirmationInput;
}

export class MatchService {
  public constructor(
    private readonly pool: Pool,
    private readonly repositories: RepositoryBundle,
    private readonly groupId: string
  ) {}

  public async previewMatch(input: PreviewMatchInput) {
    const playedAt = input.playedAt ?? new Date().toISOString();
    const calculation = new MatchCalculationService(this.repositories, this.groupId);

    const { ruleSet, playersById } = await calculation.validateCreateOrPreviewInput({
      module: input.module,
      ruleSetId: input.ruleSetId,
      participants: input.participants
    });

    const ruleVersion = await calculation.resolveApplicableRuleSetVersion({
      ruleSetId: input.ruleSetId,
      module: input.module,
      participantCount: input.participants.length,
      playedAt
    });

    const context = calculation.buildMatchCalculationContext({
      module: input.module,
      participants: input.participants,
      playedAt,
      ruleVersion
    });
    const evaluated = await calculation.evaluateMatchSettlement(context);

    return {
      module: input.module,
      note: input.note ?? null,
      ruleSet: {
        id: ruleSet.id,
        name: ruleSet.name,
        module: ruleSet.module
      },
      ruleSetVersion: {
        id: ruleVersion.id,
        versionNo: ruleVersion.versionNo,
        participantCountMin: ruleVersion.participantCountMin,
        participantCountMax: ruleVersion.participantCountMax,
        effectiveFrom: ruleVersion.effectiveFrom,
        effectiveTo: ruleVersion.effectiveTo
      },
      participants: context.participants.map((participant) => ({
        playerId: participant.playerId,
        playerName: playersById.get(participant.playerId)?.displayName ?? participant.playerId,
        tftPlacement: participant.tftPlacement,
        relativeRank: participant.relativeRank,
        suggestedNetVnd: evaluated.summary.netByPlayer[participant.playerId] ?? 0
      })),
      settlementPreview: this.toPreviewSettlement(evaluated, {
        ruleSet: {
          id: ruleSet.id,
          name: ruleSet.name,
          module: ruleSet.module
        },
        ruleVersion: {
          id: ruleVersion.id,
          versionNo: ruleVersion.versionNo,
          participantCountMin: ruleVersion.participantCountMin,
          participantCountMax: ruleVersion.participantCountMax,
          effectiveFrom: ruleVersion.effectiveFrom,
          effectiveTo: ruleVersion.effectiveTo
        },
        playersById
      })
    };
  }

  public async createMatch(input: CreateMatchInput) {
    const playedAt = input.playedAt ?? new Date().toISOString();

    const matchId = await withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const calculation = new MatchCalculationService(txRepositories, this.groupId);
      const { ruleSet, playersById } = await calculation.validateCreateOrPreviewInput({
        module: input.module,
        ruleSetId: input.ruleSetId,
        participants: input.participants
      });

      const ruleVersion = await calculation.resolveApplicableRuleSetVersion({
        ruleSetId: input.ruleSetId,
        module: input.module,
        participantCount: input.participants.length,
        playedAt,
        ruleSetVersionId: input.ruleSetVersionId
      });

      const context = calculation.buildMatchCalculationContext({
        module: input.module,
        participants: input.participants,
        playedAt,
        ruleVersion
      });
      const engineEvaluated = await calculation.evaluateMatchSettlement(context);

      const confirmationMode: MatchConfirmationMode = input.confirmation?.mode ?? "ENGINE";
      if (confirmationMode !== "ENGINE" && confirmationMode !== "MANUAL_ADJUSTED") {
        throw badRequest("MATCH_CONFIRMATION_INVALID", "confirmation.mode must be ENGINE or MANUAL_ADJUSTED");
      }

      const finalEvaluated =
        confirmationMode === "MANUAL_ADJUSTED"
          ? await calculation.buildManualAdjustedSettlementFromParticipantNets({
              module: input.module,
              context,
              participantNets: input.confirmation?.participantNets ?? [],
              overrideReason: input.confirmation?.overrideReason ?? null
            })
          : engineEvaluated;

      const originalEngineParticipantNets = this.buildParticipantNets(
        context.participants,
        engineEvaluated.summary.netByPlayer,
        playersById
      );
      const confirmedParticipantNets = this.buildParticipantNets(
        context.participants,
        finalEvaluated.summary.netByPlayer,
        playersById
      );
      const debtPeriod =
        input.module === "MATCH_STAKES" ? await txRepositories.matchStakesDebt.getOrCreateOpenPeriod(this.groupId) : null;

      const persisted = await this.persistCreatedMatch({
        txRepositories,
        input,
        playedAt,
        debtPeriodId: debtPeriod?.id ?? null,
        ruleSet: {
          id: ruleSet.id,
          name: ruleSet.name,
          module: ruleSet.module
        },
        ruleVersion: {
          id: ruleVersion.id,
          versionNo: ruleVersion.versionNo,
          participantCountMin: ruleVersion.participantCountMin,
          participantCountMax: ruleVersion.participantCountMax,
          effectiveFrom: ruleVersion.effectiveFrom,
          effectiveTo: ruleVersion.effectiveTo
        },
        contextParticipants: context.participants,
        playersById,
        confirmationMode,
        overrideReason: input.confirmation?.overrideReason ?? null,
        engineEvaluated,
        finalEvaluated,
        originalEngineParticipantNets,
        confirmedParticipantNets
      });

      await this.postLedgerEntries({
        txRepositories,
        matchId: persisted.matchId,
        settlementId: persisted.settlementId,
        module: input.module,
        lines: finalEvaluated.lines
      });

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
        entityId: persisted.matchId,
        actionType: "CREATE",
        after: {
          input: {
            ...input,
            playedAt
          },
          ruleSetId: input.ruleSetId,
          ruleSetVersionId: ruleVersion.id,
          confirmationMode,
          overrideReason: input.confirmation?.overrideReason ?? null,
          originalEngineSummary: engineEvaluated.summary,
          finalSummary: finalEvaluated.summary,
          originalEngineParticipantNets,
          confirmedParticipantNets
        }
      });

      return persisted.matchId;
    });

    return this.getMatchDetail(matchId);
  }

  public async listMatches(input: {
    module?: ModuleType;
    status?: MatchStatus;
    playerId?: string;
    ruleSetId?: string;
    periodId?: string;
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
      periodId: input.periodId,
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

        const confirmation = this.resolveConfirmationMeta(settlement?.resultSnapshot);

        return {
          id: match.id,
          module: match.module,
          playedAt: match.played_at,
          participantCount: match.participant_count,
          ruleSetId: match.rule_set_id,
          ruleSetName: ruleSet?.name ?? "Unknown",
          ruleSetVersionId: match.rule_set_version_id,
          ruleSetVersionNo: match.rule_set_version_no ?? 1,
          debtPeriodId: match.module === "MATCH_STAKES" ? match.debt_period_id : null,
          debtPeriodNo: match.module === "MATCH_STAKES" ? (match.debt_period_no ?? null) : null,
          notePreview: note ? note.slice(0, 120) : null,
          status: match.status,
          confirmationMode: confirmation.confirmationMode,
          overrideReason: confirmation.overrideReason,
          manualAdjusted: confirmation.manualAdjusted,
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

    const confirmation = this.resolveConfirmationMeta(settlement?.resultSnapshot);

    return {
      id: match.id,
      module: match.module,
      playedAt: match.played_at,
      participantCount: match.participant_count,
      status: match.status,
      note,
      confirmationMode: confirmation.confirmationMode,
      overrideReason: confirmation.overrideReason,
      manualAdjusted: confirmation.manualAdjusted,
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
      debtPeriodId: match.module === "MATCH_STAKES" ? match.debt_period_id : null,
      debtPeriodNo: match.module === "MATCH_STAKES" ? (match.debt_period_no ?? null) : null,
      engineCalculationSnapshot: match.calculation_snapshot_json ?? null,
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

  private async persistCreatedMatch(input: {
    txRepositories: RepositoryBundle;
    input: CreateMatchInput;
    playedAt: string;
    debtPeriodId: string | null;
    ruleSet: {
      id: string;
      name: string;
      module: ModuleType;
    };
    ruleVersion: {
      id: string;
      versionNo: number;
      participantCountMin: number;
      participantCountMax: number;
      effectiveFrom: string;
      effectiveTo: string | null;
    };
    contextParticipants: Array<{
      playerId: string;
      tftPlacement: number;
      relativeRank: number;
    }>;
    playersById: Map<string, { id: string; displayName: string }>;
    confirmationMode: MatchConfirmationMode;
    overrideReason: string | null;
    engineEvaluated: EvaluatedSettlement;
    finalEvaluated: EvaluatedSettlement;
    originalEngineParticipantNets: Array<{
      playerId: string;
      playerName: string;
      netVnd: number;
    }>;
    confirmedParticipantNets: Array<{
      playerId: string;
      playerName: string;
      netVnd: number;
    }>;
  }): Promise<{ matchId: string; settlementId: string }> {
    const match = await input.txRepositories.matches.createMatch({
      groupId: this.groupId,
      module: input.input.module,
      ruleSetId: input.input.ruleSetId,
      ruleSetVersionId: input.ruleVersion.id,
      debtPeriodId: input.debtPeriodId,
      playedAt: input.playedAt,
      participantCount: input.input.participants.length,
      status: "POSTED",
      inputSnapshot: {
        ...input.input,
        playedAt: input.playedAt,
        note: input.input.note ?? null,
        confirmation: {
          mode: input.confirmationMode,
          participantNets: input.input.confirmation?.participantNets ?? null,
          overrideReason: input.overrideReason
        }
      },
      calculationSnapshot: {
        engineVersion: MATCH_ENGINE_VERSION,
        ruleSetId: input.input.ruleSetId,
        ruleSetVersionId: input.ruleVersion.id,
        originalEngineResult: {
          lines: input.engineEvaluated.lines,
          summary: input.engineEvaluated.summary
        },
        originalEngineParticipantNets: input.originalEngineParticipantNets
      }
    });

    const finalNetByPlayer = input.finalEvaluated.summary.netByPlayer;
    const participantRows = input.contextParticipants.map((participant) => ({
      playerId: participant.playerId,
      tftPlacement: participant.tftPlacement,
      relativeRank: participant.relativeRank,
      isWinnerAmongParticipants: participant.relativeRank === 1,
      settlementNetVnd: finalNetByPlayer[participant.playerId] ?? 0
    }));

    await input.txRepositories.matches.insertParticipants(match.id, participantRows);

    if (input.input.note && input.input.note.trim().length > 0) {
      await input.txRepositories.matches.upsertNote(match.id, input.input.note.trim());
    }

    const settlement = await input.txRepositories.settlements.createSettlement({
      matchId: match.id,
      module: input.input.module,
      totalTransferVnd: input.finalEvaluated.summary.totalTransferVnd,
      totalFundInVnd: input.finalEvaluated.summary.totalFundInVnd,
      totalFundOutVnd: input.finalEvaluated.summary.totalFundOutVnd,
      engineVersion: MATCH_ENGINE_VERSION,
      ruleSnapshot: {
        ruleSet: input.ruleSet,
        ruleVersion: input.ruleVersion
      },
      resultSnapshot: {
        confirmationMode: input.confirmationMode,
        manualOverride: input.confirmationMode === "MANUAL_ADJUSTED",
        overrideReason: input.overrideReason,
        originalEngineParticipantNets: input.originalEngineParticipantNets,
        confirmedParticipantNets: input.confirmedParticipantNets,
        originalEngineSummary: input.engineEvaluated.summary,
        finalSummary: input.finalEvaluated.summary,
        lines: input.finalEvaluated.lines
      }
    });

    await input.txRepositories.settlements.insertSettlementLines(match.id, settlement.id, input.finalEvaluated.lines);

    return { matchId: match.id, settlementId: settlement.id };
  }

  private async postLedgerEntries(input: {
    txRepositories: RepositoryBundle;
    matchId: string;
    settlementId: string;
    module: ModuleType;
    lines: SettlementLineDraft[];
  }): Promise<void> {
    const ledgerPosting = new LedgerPostingService();
    const postingPlan = ledgerPosting.buildPostingPlan(input.lines);

    const batch = await input.txRepositories.ledgers.createBatch({
      groupId: this.groupId,
      module: input.module,
      sourceType: "MATCH_SETTLEMENT",
      matchId: input.matchId,
      description: `Match settlement for ${input.matchId}`,
      referenceCode: input.matchId
    });

    const settlementLineIds = await input.txRepositories.ledgers.getInsertedSettlementLineIds(input.settlementId);
    await input.txRepositories.ledgers.insertEntries(batch.id, settlementLineIds, postingPlan);
  }

  private buildParticipantNets(
    contextParticipants: Array<{ playerId: string }>,
    netByPlayer: Record<string, number>,
    playersById: Map<string, { id: string; displayName: string }>
  ): Array<{ playerId: string; playerName: string; netVnd: number }> {
    const byId = new Map(contextParticipants.map((item) => [item.playerId, item]));
    return [...byId.values()].map((participant) => ({
      playerId: participant.playerId,
      playerName: playersById.get(participant.playerId)?.displayName ?? participant.playerId,
      netVnd: netByPlayer[participant.playerId] ?? 0
    }));
  }

  private resolveConfirmationMeta(resultSnapshot: unknown): {
    confirmationMode: MatchConfirmationMode;
    overrideReason: string | null;
    manualAdjusted: boolean;
  } {
    if (!resultSnapshot || typeof resultSnapshot !== "object") {
      return {
        confirmationMode: "ENGINE",
        overrideReason: null,
        manualAdjusted: false
      };
    }

    const snapshot = resultSnapshot as {
      confirmationMode?: unknown;
      overrideReason?: unknown;
      manualOverride?: unknown;
    };

    const confirmationMode: MatchConfirmationMode =
      snapshot.confirmationMode === "MANUAL_ADJUSTED" ? "MANUAL_ADJUSTED" : "ENGINE";
    const overrideReason = typeof snapshot.overrideReason === "string" ? snapshot.overrideReason : null;
    const manualAdjusted = confirmationMode === "MANUAL_ADJUSTED" || snapshot.manualOverride === true;

    return {
      confirmationMode,
      overrideReason,
      manualAdjusted
    };
  }

  private toPreviewSettlement(
    evaluated: EvaluatedSettlement,
    input: {
      ruleSet: {
        id: string;
        name: string;
        module: ModuleType;
      };
      ruleVersion: {
        id: string;
        versionNo: number;
        participantCountMin: number;
        participantCountMax: number;
        effectiveFrom: string;
        effectiveTo: string | null;
      };
      playersById: Map<string, { id: string; displayName: string }>;
    }
  ) {
    return {
      totalTransferVnd: evaluated.summary.totalTransferVnd,
      totalFundInVnd: evaluated.summary.totalFundInVnd,
      totalFundOutVnd: evaluated.summary.totalFundOutVnd,
      engineVersion: MATCH_ENGINE_VERSION,
      ruleSnapshot: {
        ruleSet: input.ruleSet,
        ruleVersion: input.ruleVersion
      },
      resultSnapshot: {
        lines: evaluated.lines,
        summary: evaluated.summary
      },
      lines: evaluated.lines.map((line, index) => ({
        lineNo: index + 1,
        ruleId: line.ruleId,
        ruleCode: line.ruleCode,
        ruleName: line.ruleName,
        sourceAccountId: line.sourceAccountId,
        destinationAccountId: line.destinationAccountId,
        sourcePlayerId: line.sourcePlayerId,
        sourcePlayerName: line.sourcePlayerId ? (input.playersById.get(line.sourcePlayerId)?.displayName ?? null) : null,
        destinationPlayerId: line.destinationPlayerId,
        destinationPlayerName: line.destinationPlayerId
          ? (input.playersById.get(line.destinationPlayerId)?.displayName ?? null)
          : null,
        amountVnd: line.amountVnd,
        reasonText: line.reasonText,
        metadata: line.metadataJson
      }))
    };
  }
}
