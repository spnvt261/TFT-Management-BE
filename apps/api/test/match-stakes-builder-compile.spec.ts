import { describe, expect, it } from "vitest";
import { MatchStakesBuilderCompileService } from "../src/modules/rules/match-stakes-builder-compile.service.js";
import { MatchStakesBuilderValidationService } from "../src/modules/rules/match-stakes-builder-validation.service.js";
import { RuleEngineService } from "../src/domain/services/rule-engine/rule-engine.service.js";

const validator = new MatchStakesBuilderValidationService();
const compiler = new MatchStakesBuilderCompileService();

const accountHelper = {
  async resolveSelector(context: any, selectorType: string, selectorJson: any, subject: any) {
    const playerFromRank = (rank: number) => context.participants.find((item: any) => item.relativeRank === rank);
    const playerFromPlacement = (placement: number) => context.participants.find((item: any) => item.tftPlacement === placement);

    switch (selectorType) {
      case "SUBJECT_PLAYER":
        return { accountId: `acc-${subject.playerId}`, playerId: subject.playerId };
      case "PLAYER_BY_RELATIVE_RANK": {
        const p = playerFromRank(selectorJson.relativeRank);
        return { accountId: `acc-${p.playerId}`, playerId: p.playerId };
      }
      case "PLAYER_BY_ABSOLUTE_PLACEMENT": {
        const p = playerFromPlacement(selectorJson.placement);
        return { accountId: `acc-${p.playerId}`, playerId: p.playerId };
      }
      case "BEST_PARTICIPANT":
      case "MATCH_WINNER": {
        const p = playerFromRank(1);
        return { accountId: `acc-${p.playerId}`, playerId: p.playerId };
      }
      case "FUND_ACCOUNT":
        return { accountId: "acc-fund", playerId: null };
      case "FIXED_PLAYER": {
        const p = context.participants.find((item: any) => item.playerId === selectorJson.playerId);
        return { accountId: `acc-${p.playerId}`, playerId: p.playerId };
      }
      default:
        throw new Error(`Unsupported selector ${selectorType}`);
    }
  }
};

function buildValidatedConfig(config: unknown) {
  return validator.validate({
    module: "MATCH_STAKES",
    participantCountMin: (config as { participantCount: number }).participantCount,
    participantCountMax: (config as { participantCount: number }).participantCount,
    builderConfig: config
  });
}

function evaluate(config: unknown, participants: Array<{ playerId: string; tftPlacement: number }>) {
  const normalized = buildValidatedConfig(config);
  const rules = compiler.compile(normalized);

  const engine = new RuleEngineService(accountHelper as any);
  const context = RuleEngineService.buildContext({
    groupId: "g",
    module: "MATCH_STAKES",
    participantCount: participants.length,
    playedAt: new Date().toISOString(),
    participants,
    version: {
      id: "v-builder",
      ruleSetId: "rs-builder",
      versionNo: 1,
      participantCountMin: normalized.participantCount,
      participantCountMax: normalized.participantCount,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
      isActive: true,
      summaryJson: null,
      builderType: "MATCH_STAKES_PAYOUT",
      builderConfig: normalized,
      createdAt: new Date().toISOString(),
      rules: rules as any
    }
  });

  return engine.evaluate(context);
}

describe("match stakes builder compile", () => {
  const config3p = {
    participantCount: 3,
    winnerCount: 1,
    payouts: [{ relativeRank: 1, amountVnd: 100000 }],
    losses: [
      { relativeRank: 2, amountVnd: 50000 },
      { relativeRank: 3, amountVnd: 50000 }
    ],
    penalties: [
      { absolutePlacement: 2, amountVnd: 10000 },
      { absolutePlacement: 8, amountVnd: 10000 }
    ]
  };

  const config4p = {
    participantCount: 4,
    winnerCount: 2,
    payouts: [
      { relativeRank: 1, amountVnd: 70000 },
      { relativeRank: 2, amountVnd: 30000 }
    ],
    losses: [
      { relativeRank: 3, amountVnd: 50000 },
      { relativeRank: 4, amountVnd: 50000 }
    ],
    penalties: [
      { absolutePlacement: 2, amountVnd: 10000 },
      { absolutePlacement: 8, amountVnd: 10000 }
    ]
  };

  it("3-player one-winner compile generates deterministic transfer rules", () => {
    const normalized = buildValidatedConfig(config3p);
    const compiled = compiler.compile(normalized);

    const baseRules = compiled.filter((rule) => rule.code.startsWith("BASE_LOSS_RANK_"));
    expect(baseRules).toHaveLength(2);
    expect(baseRules.map((rule) => rule.code)).toEqual([
      "BASE_LOSS_RANK_2_TO_WINNER",
      "BASE_LOSS_RANK_3_TO_WINNER"
    ]);
    expect(baseRules[0]?.actions[0]?.destinationSelectorType).toBe("PLAYER_BY_RELATIVE_RANK");
    expect(baseRules[0]?.actions[0]?.destinationSelectorJson).toEqual({ relativeRank: 1 });
  });

  it("4-player two-winner compile generates deterministic transfer rules", () => {
    const normalized = buildValidatedConfig(config4p);
    const compiled = compiler.compile(normalized);

    const baseRules = compiled.filter((rule) => rule.code.startsWith("BASE_LOSS_RANK_"));
    expect(baseRules).toHaveLength(3);
    expect(baseRules.map((rule) => rule.code)).toEqual([
      "BASE_LOSS_RANK_3_TO_RANK_1",
      "BASE_LOSS_RANK_4_TO_RANK_1",
      "BASE_LOSS_RANK_4_TO_RANK_2"
    ]);
  });

  it("top2 and top8 penalties compile into subjectAbsolutePlacement modifier rules", () => {
    const normalized = buildValidatedConfig(config3p);
    const compiled = compiler.compile(normalized);

    const top2 = compiled.find((rule) => rule.code === "PENALTY_ABSOLUTE_PLACEMENT_2");
    const top8 = compiled.find((rule) => rule.code === "PENALTY_ABSOLUTE_PLACEMENT_8");

    expect(top2).toBeTruthy();
    expect(top8).toBeTruthy();
    expect(top2?.conditions[1]).toMatchObject({ conditionKey: "subjectAbsolutePlacement", valueJson: 2 });
    expect(top8?.conditions[1]).toMatchObject({ conditionKey: "subjectAbsolutePlacement", valueJson: 8 });
  });

  it("settlement compatibility: 3-player normal case", async () => {
    const evaluated = await evaluate(config3p, [
      { playerId: "p1", tftPlacement: 1 },
      { playerId: "p2", tftPlacement: 4 },
      { playerId: "p3", tftPlacement: 5 }
    ]);

    expect(evaluated.summary.netByPlayer.p1).toBe(100000);
    expect(evaluated.summary.netByPlayer.p2).toBe(-50000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-50000);
  });

  it("settlement compatibility: 3-player top2 penalty case does not post self-transfer", async () => {
    const evaluated = await evaluate(config3p, [
      { playerId: "p1", tftPlacement: 2 },
      { playerId: "p2", tftPlacement: 4 },
      { playerId: "p3", tftPlacement: 5 }
    ]);

    expect(evaluated.summary.netByPlayer.p1).toBe(100000);
    expect(evaluated.summary.netByPlayer.p2).toBe(-50000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-50000);
  });

  it("settlement compatibility: 4-player normal case", async () => {
    const evaluated = await evaluate(config4p, [
      { playerId: "p1", tftPlacement: 1 },
      { playerId: "p2", tftPlacement: 3 },
      { playerId: "p3", tftPlacement: 5 },
      { playerId: "p4", tftPlacement: 6 }
    ]);

    expect(evaluated.summary.netByPlayer.p1).toBe(70000);
    expect(evaluated.summary.netByPlayer.p2).toBe(30000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-50000);
    expect(evaluated.summary.netByPlayer.p4).toBe(-50000);
  });

  it("settlement compatibility: 4-player top8 penalty case", async () => {
    const evaluated = await evaluate(config4p, [
      { playerId: "p1", tftPlacement: 1 },
      { playerId: "p2", tftPlacement: 3 },
      { playerId: "p3", tftPlacement: 5 },
      { playerId: "p4", tftPlacement: 8 }
    ]);

    expect(evaluated.summary.netByPlayer.p1).toBe(80000);
    expect(evaluated.summary.netByPlayer.p2).toBe(30000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-50000);
    expect(evaluated.summary.netByPlayer.p4).toBe(-60000);
  });
});
