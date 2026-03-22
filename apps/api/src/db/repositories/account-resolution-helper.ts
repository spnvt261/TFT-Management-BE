import type { ModuleType } from "../../domain/models/enums.js";
import type { RuleSetVersionRecord } from "../../domain/models/records.js";
import type { AccountRepository, ResolvedAccount } from "./account-repository.js";
import { badRequest } from "../../core/errors/app-error.js";

export interface MatchParticipantContext {
  playerId: string;
  tftPlacement: number;
  relativeRank: number;
}

export interface MatchRuleContext {
  groupId: string;
  module: ModuleType;
  participantCount: number;
  playedAt: string;
  participants: MatchParticipantContext[];
  version: RuleSetVersionRecord;
}

export type SelectorResolutionResult = ResolvedAccount;

export class AccountResolutionHelper {
  public constructor(private readonly accountRepository: AccountRepository) {}

  public async resolveSelector(
    context: MatchRuleContext,
    selectorType: string,
    selectorJson: unknown,
    subject: MatchParticipantContext | null
  ): Promise<SelectorResolutionResult> {
    switch (selectorType) {
      case "SUBJECT_PLAYER": {
        if (!subject) {
          throw badRequest("RULE_SELECTOR_INVALID", "SUBJECT_PLAYER requires a subject participant");
        }
        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, subject.playerId, context.module);
      }

      case "PLAYER_BY_RELATIVE_RANK": {
        const relativeRank = Number((selectorJson as { relativeRank?: number } | null)?.relativeRank);
        if (!Number.isInteger(relativeRank)) {
          throw badRequest("RULE_SELECTOR_INVALID", "PLAYER_BY_RELATIVE_RANK requires relativeRank");
        }

        const participant = context.participants.find((item) => item.relativeRank === relativeRank);
        if (!participant) {
          throw badRequest("RULE_SELECTOR_NOT_FOUND", `No participant with relativeRank=${relativeRank}`);
        }

        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, participant.playerId, context.module);
      }

      case "PLAYER_BY_ABSOLUTE_PLACEMENT": {
        const placement = Number((selectorJson as { placement?: number } | null)?.placement);
        if (!Number.isInteger(placement)) {
          throw badRequest("RULE_SELECTOR_INVALID", "PLAYER_BY_ABSOLUTE_PLACEMENT requires placement");
        }

        const participant = context.participants.find((item) => item.tftPlacement === placement);
        if (!participant) {
          throw badRequest("RULE_SELECTOR_NOT_FOUND", `No participant with placement=${placement}`);
        }

        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, participant.playerId, context.module);
      }

      case "MATCH_WINNER":
      case "BEST_PARTICIPANT": {
        const winner = context.participants.find((item) => item.relativeRank === 1);
        if (!winner) {
          throw badRequest("RULE_SELECTOR_NOT_FOUND", "No winner participant found");
        }

        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, winner.playerId, context.module);
      }

      case "MATCH_RUNNER_UP": {
        const runnerUp = context.participants.find((item) => item.relativeRank === 2);
        if (!runnerUp) {
          throw badRequest("RULE_SELECTOR_NOT_FOUND", "No runner-up participant found");
        }

        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, runnerUp.playerId, context.module);
      }

      case "WORST_PARTICIPANT": {
        const worst = context.participants.find((item) => item.relativeRank === context.participantCount);
        if (!worst) {
          throw badRequest("RULE_SELECTOR_NOT_FOUND", "No worst participant found");
        }

        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, worst.playerId, context.module);
      }

      case "FUND_ACCOUNT":
        return this.accountRepository.getOrCreateFundAccount(context.groupId);

      case "SYSTEM_ACCOUNT":
        return this.accountRepository.getOrCreateSystemAccount(context.groupId);

      case "FIXED_PLAYER": {
        const playerId = String((selectorJson as { playerId?: string } | null)?.playerId ?? "");
        if (!playerId) {
          throw badRequest("RULE_SELECTOR_INVALID", "FIXED_PLAYER requires playerId");
        }

        return this.accountRepository.getOrCreatePlayerAccount(context.groupId, playerId, context.module);
      }

      default:
        throw badRequest("RULE_SELECTOR_INVALID", `Unsupported selector type: ${selectorType}`);
    }
  }
}
