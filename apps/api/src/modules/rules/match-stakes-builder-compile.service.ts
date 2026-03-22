import type { CreateRuleVersionRuleInput } from "../../db/repositories/rule-repository.js";
import type { MatchStakesBuilderConfig, MatchStakesPenaltyConfig } from "./builder-types.js";
import { badRequest } from "../../core/errors/app-error.js";

interface BaseTransfer {
  fromRank: number;
  toRank: number;
  amountVnd: number;
}

export class MatchStakesBuilderCompileService {
  public compile(builderConfig: MatchStakesBuilderConfig): CreateRuleVersionRuleInput[] {
    const baseTransfers = this.buildBaseTransfers(builderConfig);

    const baseRules = baseTransfers.map((transfer, index) => {
      const destinationSegment =
        builderConfig.winnerCount === 1 && transfer.toRank === 1 ? "WINNER" : `RANK_${transfer.toRank}`;

      return {
        code: `BASE_LOSS_RANK_${transfer.fromRank}_TO_${destinationSegment}`,
        name: `Base Loss Rank ${transfer.fromRank} To Rank ${transfer.toRank}`,
        description: `Base distribution from relative rank ${transfer.fromRank} to relative rank ${transfer.toRank}`,
        ruleKind: "BASE_RELATIVE_RANK",
        priority: 100 + index,
        status: "ACTIVE",
        stopProcessingOnMatch: false,
        metadata: {
          builderType: "MATCH_STAKES_PAYOUT",
          category: "BASE"
        },
        conditions: [
          {
            conditionKey: "participantCount",
            operator: "EQ",
            valueJson: builderConfig.participantCount,
            sortOrder: 1
          },
          {
            conditionKey: "subjectRelativeRank",
            operator: "EQ",
            valueJson: transfer.fromRank,
            sortOrder: 2
          }
        ],
        actions: [
          {
            actionType: "TRANSFER",
            amountVnd: transfer.amountVnd,
            sourceSelectorType: "SUBJECT_PLAYER",
            sourceSelectorJson: {},
            destinationSelectorType: "PLAYER_BY_RELATIVE_RANK",
            destinationSelectorJson: { relativeRank: transfer.toRank },
            descriptionTemplate: `Base payout transfer: rank ${transfer.fromRank} pays rank ${transfer.toRank} ${transfer.amountVnd}`,
            sortOrder: 1
          }
        ]
      } satisfies CreateRuleVersionRuleInput;
    });

    const penaltyRules = [...builderConfig.penalties]
      .sort((left, right) => left.absolutePlacement - right.absolutePlacement)
      .map((penalty, index) => this.compilePenalty(builderConfig, penalty, index));

    return [...baseRules, ...penaltyRules];
  }

  private buildBaseTransfers(builderConfig: MatchStakesBuilderConfig): BaseTransfer[] {
    const winners = [...builderConfig.payouts].sort((left, right) => left.relativeRank - right.relativeRank);
    const losers = [...builderConfig.losses].sort((left, right) => left.relativeRank - right.relativeRank);

    const remainingByWinner = new Map<number, number>();
    for (const winner of winners) {
      remainingByWinner.set(winner.relativeRank, winner.amountVnd);
    }

    const transfers: BaseTransfer[] = [];

    for (const loser of losers) {
      let remainingLoss = loser.amountVnd;

      for (const winner of winners) {
        if (remainingLoss <= 0) {
          break;
        }

        const winnerRemaining = remainingByWinner.get(winner.relativeRank) ?? 0;
        if (winnerRemaining <= 0) {
          continue;
        }

        const transferAmount = Math.min(remainingLoss, winnerRemaining);
        if (transferAmount <= 0) {
          continue;
        }

        transfers.push({
          fromRank: loser.relativeRank,
          toRank: winner.relativeRank,
          amountVnd: transferAmount
        });

        remainingLoss -= transferAmount;
        remainingByWinner.set(winner.relativeRank, winnerRemaining - transferAmount);
      }

      if (remainingLoss !== 0) {
        throw badRequest(
          "RULE_BUILDER_PAYOUT_LOSS_UNBALANCED",
          "Unable to allocate all loser losses to winners deterministically"
        );
      }
    }

    for (const amount of remainingByWinner.values()) {
      if (amount !== 0) {
        throw badRequest(
          "RULE_BUILDER_PAYOUT_LOSS_UNBALANCED",
          "Unable to satisfy all winner payouts from loser losses"
        );
      }
    }

    return transfers;
  }

  private compilePenalty(
    builderConfig: MatchStakesBuilderConfig,
    penalty: MatchStakesPenaltyConfig,
    index: number
  ): CreateRuleVersionRuleInput {
    const code = penalty.code ?? `PENALTY_ABSOLUTE_PLACEMENT_${penalty.absolutePlacement}`;

    return {
      code,
      name: penalty.name ?? `Penalty Absolute Placement ${penalty.absolutePlacement}`,
      description: penalty.description ?? `Penalty for absolute TFT placement ${penalty.absolutePlacement}`,
      ruleKind: "ABSOLUTE_PLACEMENT_MODIFIER",
      priority: 200 + index,
      status: "ACTIVE",
      stopProcessingOnMatch: false,
      metadata: {
        builderType: "MATCH_STAKES_PAYOUT",
        category: "PENALTY",
        absolutePlacement: penalty.absolutePlacement
      },
      conditions: [
        {
          conditionKey: "participantCount",
          operator: "EQ",
          valueJson: builderConfig.participantCount,
          sortOrder: 1
        },
        {
          conditionKey: "subjectAbsolutePlacement",
          operator: "EQ",
          valueJson: penalty.absolutePlacement,
          sortOrder: 2
        }
      ],
      actions: [
        {
          actionType: "TRANSFER",
          amountVnd: penalty.amountVnd,
          sourceSelectorType: "SUBJECT_PLAYER",
          sourceSelectorJson: {},
          destinationSelectorType: penalty.destinationSelectorType,
          destinationSelectorJson: penalty.destinationSelectorJson ?? {},
          descriptionTemplate:
            penalty.description ??
            `Penalty transfer: placement ${penalty.absolutePlacement} pays ${penalty.amountVnd} to ${penalty.destinationSelectorType}`,
          sortOrder: 1
        }
      ]
    };
  }
}
