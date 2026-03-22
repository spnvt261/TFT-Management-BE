import { describe, expect, it } from "vitest";
import { MatchStakesBuilderValidationService } from "../src/modules/rules/match-stakes-builder-validation.service.js";
import { AppError } from "../src/core/errors/app-error.js";

const validator = new MatchStakesBuilderValidationService();

function validConfig() {
  return {
    participantCount: 3,
    winnerCount: 1,
    payouts: [{ relativeRank: 1, amountVnd: 100000 }],
    losses: [
      { relativeRank: 2, amountVnd: 50000 },
      { relativeRank: 3, amountVnd: 50000 }
    ],
    penalties: [{ absolutePlacement: 8, amountVnd: 10000 }]
  };
}

function expectValidationError(code: string, builderConfig: unknown): void {
  const participantCount =
    typeof builderConfig === "object" &&
    builderConfig !== null &&
    "participantCount" in builderConfig &&
    typeof (builderConfig as { participantCount?: unknown }).participantCount === "number"
      ? (builderConfig as { participantCount: number }).participantCount
      : 3;

  try {
    validator.validate({
      module: "MATCH_STAKES",
      participantCountMin: participantCount,
      participantCountMax: participantCount,
      builderConfig
    });
    throw new Error("Expected validation to fail");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}

describe("match stakes builder validation", () => {
  it("rejects unsupported module", () => {
    try {
      validator.validate({
        module: "GROUP_FUND",
        participantCountMin: 3,
        participantCountMax: 3,
        builderConfig: validConfig()
      });
      throw new Error("Expected validation to fail");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("RULE_BUILDER_UNSUPPORTED_MODULE");
    }
  });

  it("rejects participantCount outside supported range", () => {
    expectValidationError("RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED", {
      ...validConfig(),
      participantCount: 5
    });
  });

  it("rejects winnerCount >= participantCount", () => {
    expectValidationError("RULE_BUILDER_INVALID_CONFIG", {
      ...validConfig(),
      winnerCount: 3,
      payouts: [
        { relativeRank: 1, amountVnd: 50000 },
        { relativeRank: 2, amountVnd: 50000 },
        { relativeRank: 3, amountVnd: 50000 }
      ],
      losses: []
    });
  });

  it("rejects duplicate payout ranks", () => {
    expectValidationError("RULE_BUILDER_DUPLICATE_RANK", {
      participantCount: 4,
      winnerCount: 2,
      payouts: [
        { relativeRank: 1, amountVnd: 70000 },
        { relativeRank: 1, amountVnd: 30000 }
      ],
      losses: [
        { relativeRank: 3, amountVnd: 50000 },
        { relativeRank: 4, amountVnd: 50000 }
      ]
    });
  });

  it("rejects duplicate loss ranks", () => {
    expectValidationError("RULE_BUILDER_DUPLICATE_RANK", {
      participantCount: 4,
      winnerCount: 2,
      payouts: [
        { relativeRank: 1, amountVnd: 70000 },
        { relativeRank: 2, amountVnd: 30000 }
      ],
      losses: [
        { relativeRank: 3, amountVnd: 30000 },
        { relativeRank: 3, amountVnd: 70000 }
      ]
    });
  });

  it("rejects incomplete rank coverage", () => {
    expectValidationError("RULE_BUILDER_RANK_COVERAGE_INVALID", {
      participantCount: 4,
      winnerCount: 2,
      payouts: [
        { relativeRank: 1, amountVnd: 70000 },
        { relativeRank: 2, amountVnd: 30000 }
      ],
      losses: [
        { relativeRank: 3, amountVnd: 100000 }
      ]
    });
  });

  it("rejects unbalanced base payout/loss totals", () => {
    expectValidationError("RULE_BUILDER_PAYOUT_LOSS_UNBALANCED", {
      ...validConfig(),
      losses: [
        { relativeRank: 2, amountVnd: 40000 },
        { relativeRank: 3, amountVnd: 50000 }
      ]
    });
  });

  it("rejects invalid penalty absolute placement", () => {
    expectValidationError("RULE_BUILDER_INVALID_CONFIG", {
      ...validConfig(),
      penalties: [{ absolutePlacement: 9, amountVnd: 10000 }]
    });
  });
});
