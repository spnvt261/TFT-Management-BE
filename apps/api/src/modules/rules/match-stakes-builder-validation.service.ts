import { badRequest } from "../../core/errors/app-error.js";
import type { ModuleType } from "../../domain/models/enums.js";
import {
  matchStakesBuilderConfigInputSchema,
  type MatchStakesBuilderConfig,
  type MatchStakesBuilderConfigInput,
  type MatchStakesPenaltyConfig,
  type MatchStakesPenaltyDestinationSelectorType
} from "./builder-types.js";

const SUPPORTED_PARTICIPANT_COUNTS = new Set([3, 4]);

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export class MatchStakesBuilderValidationService {
  public validate(input: {
    module: ModuleType;
    participantCountMin: number;
    participantCountMax: number;
    builderConfig: unknown;
  }): MatchStakesBuilderConfig {
    if (input.module !== "MATCH_STAKES") {
      throw badRequest(
        "RULE_BUILDER_UNSUPPORTED_MODULE",
        "MATCH_STAKES builder is only supported for MATCH_STAKES module"
      );
    }

    const parsed = matchStakesBuilderConfigInputSchema.safeParse(input.builderConfig);
    if (!parsed.success) {
      throw badRequest("RULE_BUILDER_INVALID_CONFIG", "Invalid MATCH_STAKES builder config", parsed.error.issues);
    }

    const config = this.normalize(parsed.data);

    if (!SUPPORTED_PARTICIPANT_COUNTS.has(config.participantCount)) {
      throw badRequest(
        "RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED",
        "participantCount must be one of: 3, 4"
      );
    }

    if (
      input.participantCountMin !== config.participantCount ||
      input.participantCountMax !== config.participantCount
    ) {
      throw badRequest(
        "RULE_BUILDER_INVALID_CONFIG",
        "participantCountMin and participantCountMax must match builderConfig.participantCount"
      );
    }

    if (config.winnerCount < 1 || config.winnerCount >= config.participantCount) {
      throw badRequest(
        "RULE_BUILDER_INVALID_CONFIG",
        "winnerCount must be >= 1 and < participantCount"
      );
    }

    if (config.payouts.length !== config.winnerCount) {
      throw badRequest(
        "RULE_BUILDER_INVALID_CONFIG",
        "payouts length must equal winnerCount"
      );
    }

    this.validateAmounts(config);
    this.validateDuplicateRanks(config);
    this.validateRankCoverage(config);
    this.validateBaseBalance(config);
    this.validatePenalties(config.penalties);

    return config;
  }

  private normalize(input: MatchStakesBuilderConfigInput): MatchStakesBuilderConfig {
    return {
      participantCount: input.participantCount as 3 | 4,
      winnerCount: input.winnerCount,
      payouts: [...input.payouts].map((item) => ({
        relativeRank: item.relativeRank,
        amountVnd: item.amountVnd
      })),
      losses: [...input.losses].map((item) => ({
        relativeRank: item.relativeRank,
        amountVnd: item.amountVnd
      })),
      penalties: [...(input.penalties ?? [])].map((penalty) => ({
        absolutePlacement: penalty.absolutePlacement,
        amountVnd: penalty.amountVnd,
        destinationSelectorType: (penalty.destinationSelectorType ??
          "BEST_PARTICIPANT") as MatchStakesPenaltyDestinationSelectorType,
        destinationSelectorJson: penalty.destinationSelectorJson ?? {},
        code: penalty.code,
        name: penalty.name,
        description: penalty.description ?? null
      }))
    };
  }

  private validateAmounts(config: MatchStakesBuilderConfig): void {
    for (const payout of config.payouts) {
      if (!isPositiveInteger(payout.amountVnd)) {
        throw badRequest("RULE_BUILDER_INVALID_CONFIG", "All payout amounts must be positive integers");
      }
    }

    for (const loss of config.losses) {
      if (!isPositiveInteger(loss.amountVnd)) {
        throw badRequest("RULE_BUILDER_INVALID_CONFIG", "All loss amounts must be positive integers");
      }
    }

    for (const penalty of config.penalties) {
      if (!isPositiveInteger(penalty.amountVnd)) {
        throw badRequest("RULE_BUILDER_INVALID_CONFIG", "All penalty amounts must be positive integers");
      }
    }
  }

  private validateDuplicateRanks(config: MatchStakesBuilderConfig): void {
    const payoutRanks = new Set<number>();
    for (const payout of config.payouts) {
      if (payoutRanks.has(payout.relativeRank)) {
        throw badRequest("RULE_BUILDER_DUPLICATE_RANK", "Duplicate payout relativeRank detected");
      }
      payoutRanks.add(payout.relativeRank);
    }

    const lossRanks = new Set<number>();
    for (const loss of config.losses) {
      if (lossRanks.has(loss.relativeRank)) {
        throw badRequest("RULE_BUILDER_DUPLICATE_RANK", "Duplicate loss relativeRank detected");
      }
      lossRanks.add(loss.relativeRank);
    }
  }

  private validateRankCoverage(config: MatchStakesBuilderConfig): void {
    const allRanks = [...config.payouts, ...config.losses].map((item) => item.relativeRank);
    const uniqueRanks = new Set(allRanks);

    if (allRanks.length !== config.participantCount || uniqueRanks.size !== config.participantCount) {
      throw badRequest(
        "RULE_BUILDER_RANK_COVERAGE_INVALID",
        "payout ranks and loss ranks must cover all ranks from 1..participantCount exactly once"
      );
    }

    for (let rank = 1; rank <= config.participantCount; rank += 1) {
      if (!uniqueRanks.has(rank)) {
        throw badRequest(
          "RULE_BUILDER_RANK_COVERAGE_INVALID",
          "payout ranks and loss ranks must cover all ranks from 1..participantCount exactly once"
        );
      }
    }
  }

  private validateBaseBalance(config: MatchStakesBuilderConfig): void {
    const totalPayout = config.payouts.reduce((sum, item) => sum + item.amountVnd, 0);
    const totalLoss = config.losses.reduce((sum, item) => sum + item.amountVnd, 0);

    if (totalPayout !== totalLoss) {
      throw badRequest(
        "RULE_BUILDER_PAYOUT_LOSS_UNBALANCED",
        "Total base payouts must equal total base losses"
      );
    }
  }

  private validatePenalties(penalties: MatchStakesPenaltyConfig[]): void {
    const placements = new Set<number>();

    for (const penalty of penalties) {
      if (!Number.isInteger(penalty.absolutePlacement) || penalty.absolutePlacement < 1 || penalty.absolutePlacement > 8) {
        throw badRequest(
          "RULE_BUILDER_INVALID_CONFIG",
          "Penalty absolutePlacement must be an integer in range 1..8"
        );
      }

      if (placements.has(penalty.absolutePlacement)) {
        throw badRequest("RULE_BUILDER_INVALID_CONFIG", "Duplicate penalty absolutePlacement detected");
      }
      placements.add(penalty.absolutePlacement);

      if (penalty.destinationSelectorType === "FIXED_PLAYER") {
        const playerId = String((penalty.destinationSelectorJson as { playerId?: unknown } | null)?.playerId ?? "");
        if (!playerId) {
          throw badRequest(
            "RULE_BUILDER_INVALID_CONFIG",
            "FIXED_PLAYER destination selector requires destinationSelectorJson.playerId"
          );
        }
      }
    }
  }
}
