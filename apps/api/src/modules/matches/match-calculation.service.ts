import { badRequest, notFound, unprocessable } from "../../core/errors/app-error.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { AccountResolutionHelper } from "../../db/repositories/account-resolution-helper.js";
import { RuleEngineService, type EvaluatedSettlement } from "../../domain/services/rule-engine/rule-engine.service.js";
import type { MatchRuleContext } from "../../db/repositories/account-resolution-helper.js";
import type { ModuleType } from "../../domain/models/enums.js";
import type { RuleSetRecord, RuleSetVersionRecord, SettlementLineDraft } from "../../domain/models/records.js";

export const MATCH_ENGINE_VERSION = "v1";

export type MatchConfirmationMode = "ENGINE" | "MANUAL_ADJUSTED";

export interface MatchParticipantInput {
  playerId: string;
  tftPlacement: number;
}

export interface MatchConfirmationInput {
  mode: MatchConfirmationMode;
  participantNets?: Array<{
    playerId: string;
    netVnd: number;
  }>;
  overrideReason?: string | null;
}

export interface ValidateCreateOrPreviewInput {
  module: ModuleType;
  ruleSetId: string;
  participants: MatchParticipantInput[];
}

export interface ResolveApplicableRuleSetVersionInput {
  ruleSetId: string;
  module: ModuleType;
  participantCount: number;
  playedAt: string;
  ruleSetVersionId?: string;
}

export interface BuildMatchCalculationContextInput {
  module: ModuleType;
  participants: MatchParticipantInput[];
  playedAt: string;
  ruleVersion: RuleSetVersionRecord;
}

export interface BuildManualAdjustedSettlementInput {
  module: ModuleType;
  context: MatchRuleContext;
  participantNets: Array<{
    playerId: string;
    netVnd: number;
  }>;
  overrideReason?: string | null;
}

export class MatchCalculationService {
  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

  public async validateCreateOrPreviewInput(input: ValidateCreateOrPreviewInput): Promise<{
    ruleSet: RuleSetRecord;
    playersById: Map<string, { id: string; displayName: string }>;
  }> {
    this.validateParticipants(input.participants);

    const playerIds = input.participants.map((item) => item.playerId);
    const activePlayers = await this.repositories.players.findActiveByIds(this.groupId, playerIds);
    if (activePlayers.length !== input.participants.length) {
      throw unprocessable("MATCH_PLAYERS_INVALID", "One or more participants are inactive or not in the group");
    }

    const ruleSet = await this.repositories.rules.getRuleSetById(this.groupId, input.ruleSetId);
    if (!ruleSet) {
      throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
    }

    if (ruleSet.module !== input.module) {
      throw unprocessable("MATCH_RULE_SET_MODULE_MISMATCH", "Rule set module does not match request module");
    }

    const playersById = new Map<string, { id: string; displayName: string }>();
    for (const player of activePlayers) {
      playersById.set(player.id, { id: player.id, displayName: player.displayName });
    }

    return { ruleSet, playersById };
  }

  public async resolveApplicableRuleSetVersion(input: ResolveApplicableRuleSetVersionInput): Promise<RuleSetVersionRecord> {
    const resolved = await this.repositories.rules.resolveVersionForMatch({
      ruleSetId: input.ruleSetId,
      module: input.module,
      participantCount: input.participantCount,
      playedAt: input.playedAt,
      versionId: input.ruleSetVersionId
    });

    if (!resolved) {
      throw unprocessable(
        "RULE_SET_VERSION_NOT_APPLICABLE",
        "No applicable rule set version for participant count/effective window"
      );
    }

    return resolved;
  }

  public buildMatchCalculationContext(input: BuildMatchCalculationContextInput): MatchRuleContext {
    return RuleEngineService.buildContext({
      groupId: this.groupId,
      module: input.module,
      participantCount: input.participants.length,
      playedAt: input.playedAt,
      participants: input.participants,
      version: input.ruleVersion
    });
  }

  public async evaluateMatchSettlement(context: MatchRuleContext): Promise<EvaluatedSettlement> {
    const accountResolutionHelper = new AccountResolutionHelper(this.repositories.accounts);
    const engine = new RuleEngineService(accountResolutionHelper);
    return engine.evaluate(context);
  }

  public async buildManualAdjustedSettlementFromParticipantNets(
    input: BuildManualAdjustedSettlementInput
  ): Promise<EvaluatedSettlement> {
    const participantIds = input.context.participants.map((item) => item.playerId);
    const participantIdSet = new Set(participantIds);

    if (input.participantNets.length !== participantIds.length) {
      throw badRequest(
        "MATCH_CONFIRMATION_INVALID",
        "confirmation.participantNets must include every participant exactly once"
      );
    }

    const netByPlayer: Record<string, number> = {};
    const seen = new Set<string>();
    for (const item of input.participantNets) {
      if (!participantIdSet.has(item.playerId)) {
        throw badRequest("MATCH_CONFIRMATION_INVALID", "confirmation.participantNets includes unknown playerId");
      }
      if (seen.has(item.playerId)) {
        throw badRequest("MATCH_CONFIRMATION_INVALID", "confirmation.participantNets has duplicate playerId");
      }
      if (!Number.isInteger(item.netVnd)) {
        throw badRequest("MATCH_CONFIRMATION_INVALID", "confirmation.participantNets.netVnd must be an integer");
      }
      seen.add(item.playerId);
      netByPlayer[item.playerId] = item.netVnd;
    }

    for (const participantId of participantIds) {
      if (!seen.has(participantId)) {
        throw badRequest("MATCH_CONFIRMATION_INVALID", "confirmation.participantNets must include every participant exactly once");
      }
      if (netByPlayer[participantId] === undefined) {
        netByPlayer[participantId] = 0;
      }
    }

    if (input.module === "MATCH_STAKES") {
      const sum = participantIds.reduce((acc, playerId) => acc + (netByPlayer[playerId] ?? 0), 0);
      if (sum !== 0) {
        throw badRequest("MATCH_CONFIRMATION_INVALID", "MATCH_STAKES participant net sum must equal 0");
      }
    }

    const orderedParticipants = [...input.context.participants].sort((left, right) => left.relativeRank - right.relativeRank);
    const playerAccountCache = new Map<string, { accountId: string; playerId: string | null }>();
    const resolvePlayerAccount = async (playerId: string) => {
      const cached = playerAccountCache.get(playerId);
      if (cached) {
        return cached;
      }
      const resolved = await this.repositories.accounts.getOrCreatePlayerAccount(this.groupId, playerId, input.module);
      playerAccountCache.set(playerId, resolved);
      return resolved;
    };

    const lines: SettlementLineDraft[] = [];

    if (input.module === "MATCH_STAKES") {
      const payers = orderedParticipants.filter((item) => (netByPlayer[item.playerId] ?? 0) < 0);
      const receivers = orderedParticipants.filter((item) => (netByPlayer[item.playerId] ?? 0) > 0);
      const receiverRemaining = new Map<string, number>();

      for (const receiver of receivers) {
        receiverRemaining.set(receiver.playerId, netByPlayer[receiver.playerId] ?? 0);
      }

      for (const payer of payers) {
        let payRemaining = Math.abs(netByPlayer[payer.playerId] ?? 0);
        for (const receiver of receivers) {
          if (payRemaining <= 0) {
            break;
          }

          const receiverBalance = receiverRemaining.get(receiver.playerId) ?? 0;
          if (receiverBalance <= 0) {
            continue;
          }

          const transferAmount = Math.min(payRemaining, receiverBalance);
          if (transferAmount <= 0) {
            continue;
          }

          const source = await resolvePlayerAccount(payer.playerId);
          const destination = await resolvePlayerAccount(receiver.playerId);

          lines.push({
            ruleId: null,
            ruleCode: "MANUAL_OVERRIDE",
            ruleName: "Manual confirmed settlement",
            sourceAccountId: source.accountId,
            destinationAccountId: destination.accountId,
            sourcePlayerId: payer.playerId,
            destinationPlayerId: receiver.playerId,
            amountVnd: transferAmount,
            reasonText: "Manual confirmed settlement",
            metadataJson: {
              manualOverride: true,
              overrideReason: input.overrideReason ?? null,
              confirmationMode: "MANUAL_ADJUSTED",
              sourceRelativeRank: payer.relativeRank,
              destinationRelativeRank: receiver.relativeRank
            }
          });

          payRemaining -= transferAmount;
          receiverRemaining.set(receiver.playerId, receiverBalance - transferAmount);
        }

        if (payRemaining !== 0) {
          throw badRequest("MATCH_CONFIRMATION_INVALID", "Unable to allocate manual participant nets deterministically");
        }
      }

      for (const value of receiverRemaining.values()) {
        if (value !== 0) {
          throw badRequest("MATCH_CONFIRMATION_INVALID", "Manual participant nets are not balanced");
        }
      }
    } else {
      const fund = await this.repositories.accounts.getOrCreateFundAccount(this.groupId);

      for (const participant of orderedParticipants) {
        const net = netByPlayer[participant.playerId] ?? 0;
        if (net === 0) {
          continue;
        }

        const player = await resolvePlayerAccount(participant.playerId);
        const playerPaysFund = net < 0;

        lines.push({
          ruleId: null,
          ruleCode: "MANUAL_OVERRIDE",
          ruleName: "Manual confirmed settlement",
          sourceAccountId: playerPaysFund ? player.accountId : fund.accountId,
          destinationAccountId: playerPaysFund ? fund.accountId : player.accountId,
          sourcePlayerId: playerPaysFund ? participant.playerId : null,
          destinationPlayerId: playerPaysFund ? null : participant.playerId,
          amountVnd: Math.abs(net),
          reasonText: "Manual confirmed settlement",
          metadataJson: {
            manualOverride: true,
            overrideReason: input.overrideReason ?? null,
            confirmationMode: "MANUAL_ADJUSTED",
            relativeRank: participant.relativeRank
          }
        });
      }
    }

    return {
      lines,
      summary: summarizeSettlementLines(lines, participantIds)
    };
  }

  private validateParticipants(participants: MatchParticipantInput[]): void {
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

export function summarizeSettlementLines(lines: SettlementLineDraft[], participantIds: string[]): {
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  netByPlayer: Record<string, number>;
} {
  let totalTransferVnd = 0;
  let totalFundInVnd = 0;
  let totalFundOutVnd = 0;
  const netByPlayer: Record<string, number> = {};

  for (const participantId of participantIds) {
    netByPlayer[participantId] = 0;
  }

  for (const line of lines) {
    totalTransferVnd += line.amountVnd;
    if (line.destinationPlayerId === null) {
      totalFundInVnd += line.amountVnd;
    }
    if (line.sourcePlayerId === null) {
      totalFundOutVnd += line.amountVnd;
    }

    if (line.sourcePlayerId !== null) {
      netByPlayer[line.sourcePlayerId] = (netByPlayer[line.sourcePlayerId] ?? 0) - line.amountVnd;
    }
    if (line.destinationPlayerId !== null) {
      netByPlayer[line.destinationPlayerId] = (netByPlayer[line.destinationPlayerId] ?? 0) + line.amountVnd;
    }
  }

  return {
    totalTransferVnd,
    totalFundInVnd,
    totalFundOutVnd,
    netByPlayer
  };
}
