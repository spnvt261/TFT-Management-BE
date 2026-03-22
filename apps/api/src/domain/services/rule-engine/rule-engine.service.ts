import type { SettlementLineDraft, RuleSetVersionRecord } from "../../models/records.js";
import { hasSubjectScopedCondition, evaluateConditions } from "./condition-evaluator.js";
import type { MatchRuleContext } from "../../../db/repositories/account-resolution-helper.js";
import { AccountResolutionHelper } from "../../../db/repositories/account-resolution-helper.js";

export interface EvaluatedSettlement {
  lines: SettlementLineDraft[];
  summary: {
    totalTransferVnd: number;
    totalFundInVnd: number;
    totalFundOutVnd: number;
    netByPlayer: Record<string, number>;
  };
}

export class RuleEngineService {
  public constructor(private readonly accountResolutionHelper: AccountResolutionHelper) {}

  public async evaluate(context: MatchRuleContext): Promise<EvaluatedSettlement> {
    const sortedRules = [...context.version.rules].sort((left, right) => left.priority - right.priority);

    const lines: SettlementLineDraft[] = [];
    const netByPlayer: Record<string, number> = {};

    for (const rule of sortedRules) {
      if (rule.status !== "ACTIVE") {
        continue;
      }

      const scoped = hasSubjectScopedCondition(rule.conditions);
      const candidateSubjects = scoped ? context.participants : [null];

      for (const subject of candidateSubjects) {
        if (!evaluateConditions(context, rule.conditions, subject)) {
          continue;
        }

        for (const action of rule.actions) {
          if (action.amountVnd <= 0) {
            continue;
          }

          const source = await this.accountResolutionHelper.resolveSelector(
            context,
            action.sourceSelectorType,
            action.sourceSelectorJson,
            subject
          );

          const destination = await this.accountResolutionHelper.resolveSelector(
            context,
            action.destinationSelectorType,
            action.destinationSelectorJson,
            subject
          );

          if (source.accountId === destination.accountId) {
            continue;
          }

          const reasonText = action.descriptionTemplate ?? `${rule.name} (${rule.code})`;

          lines.push({
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleName: rule.name,
            sourceAccountId: source.accountId,
            destinationAccountId: destination.accountId,
            sourcePlayerId: source.playerId,
            destinationPlayerId: destination.playerId,
            amountVnd: action.amountVnd,
            reasonText,
            metadataJson: {
              actionType: action.actionType,
              sourceSelectorType: action.sourceSelectorType,
              destinationSelectorType: action.destinationSelectorType
            }
          });

          if (source.playerId) {
            netByPlayer[source.playerId] = (netByPlayer[source.playerId] ?? 0) - action.amountVnd;
          }

          if (destination.playerId) {
            netByPlayer[destination.playerId] = (netByPlayer[destination.playerId] ?? 0) + action.amountVnd;
          }
        }

        if (rule.stopProcessingOnMatch) {
          break;
        }
      }
    }

    let totalTransferVnd = 0;
    let totalFundInVnd = 0;
    let totalFundOutVnd = 0;

    for (const line of lines) {
      totalTransferVnd += line.amountVnd;
      if (line.destinationPlayerId === null) {
        totalFundInVnd += line.amountVnd;
      }
      if (line.sourcePlayerId === null) {
        totalFundOutVnd += line.amountVnd;
      }
    }

    return {
      lines,
      summary: {
        totalTransferVnd,
        totalFundInVnd,
        totalFundOutVnd,
        netByPlayer
      }
    };
  }

  public static buildContext(input: {
    groupId: string;
    module: "MATCH_STAKES" | "GROUP_FUND";
    participantCount: number;
    playedAt: string;
    participants: Array<{ playerId: string; tftPlacement: number }>;
    version: RuleSetVersionRecord;
  }): MatchRuleContext {
    const participants = [...input.participants]
      .sort((left, right) => left.tftPlacement - right.tftPlacement)
      .map((item, index) => ({
        playerId: item.playerId,
        tftPlacement: item.tftPlacement,
        relativeRank: index + 1
      }));

    return {
      groupId: input.groupId,
      module: input.module,
      participantCount: input.participantCount,
      playedAt: input.playedAt,
      participants,
      version: input.version
    };
  }
}
