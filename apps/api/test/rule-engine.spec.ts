import { describe, expect, it } from "vitest";
import { RuleEngineService } from "../src/domain/services/rule-engine/rule-engine.service.js";

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
      case "MATCH_RUNNER_UP": {
        const p = playerFromRank(2);
        return { accountId: `acc-${p.playerId}`, playerId: p.playerId };
      }
      case "FUND_ACCOUNT":
        return { accountId: "acc-fund", playerId: null };
      default:
        throw new Error(`Unsupported selector ${selectorType}`);
    }
  }
};

function buildRuleVersion(versionNo: number, participantCount: number) {
  if (participantCount === 3) {
    return {
      id: "v3",
      ruleSetId: "rs",
      versionNo,
      participantCountMin: 3,
      participantCountMax: 3,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
      isActive: true,
      summaryJson: null,
      createdAt: new Date().toISOString(),
      rules: [
        {
          id: "r1",
          code: "MS3_BASE_WINNER",
          name: "3P Winner Base",
          description: null,
          ruleKind: "BASE_RELATIVE_RANK",
          priority: 100,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadata: null,
          conditions: [
            { id: "c1", conditionKey: "participantCount", operator: "EQ", valueJson: 3, sortOrder: 1 },
            { id: "c2", conditionKey: "subjectRelativeRank", operator: "EQ", valueJson: 1, sortOrder: 2 }
          ],
          actions: [
            {
              id: "a1",
              actionType: "TRANSFER",
              amountVnd: 50000,
              sourceSelectorType: "PLAYER_BY_RELATIVE_RANK",
              sourceSelectorJson: { relativeRank: 2 },
              destinationSelectorType: "SUBJECT_PLAYER",
              destinationSelectorJson: {},
              descriptionTemplate: "base",
              sortOrder: 1
            },
            {
              id: "a2",
              actionType: "TRANSFER",
              amountVnd: 50000,
              sourceSelectorType: "PLAYER_BY_RELATIVE_RANK",
              sourceSelectorJson: { relativeRank: 3 },
              destinationSelectorType: "SUBJECT_PLAYER",
              destinationSelectorJson: {},
              descriptionTemplate: "base",
              sortOrder: 2
            }
          ]
        },
        {
          id: "r2",
          code: "TOP1_TOP2",
          name: "top1-top2",
          description: null,
          ruleKind: "PAIR_CONDITION_MODIFIER",
          priority: 200,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadata: null,
          conditions: [
            { id: "c3", conditionKey: "participantCount", operator: "EQ", valueJson: 3, sortOrder: 1 },
            { id: "c4", conditionKey: "matchContainsAbsolutePlacements", operator: "CONTAINS", valueJson: [1, 2], sortOrder: 2 }
          ],
          actions: [
            {
              id: "a3",
              actionType: "TRANSFER",
              amountVnd: 10000,
              sourceSelectorType: "PLAYER_BY_ABSOLUTE_PLACEMENT",
              sourceSelectorJson: { placement: 2 },
              destinationSelectorType: "PLAYER_BY_ABSOLUTE_PLACEMENT",
              destinationSelectorJson: { placement: 1 },
              descriptionTemplate: "top1-top2",
              sortOrder: 1
            }
          ]
        },
        {
          id: "r3",
          code: "TOP8",
          name: "top8",
          description: null,
          ruleKind: "ABSOLUTE_PLACEMENT_MODIFIER",
          priority: 300,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadata: null,
          conditions: [
            { id: "c5", conditionKey: "participantCount", operator: "EQ", valueJson: 3, sortOrder: 1 },
            { id: "c6", conditionKey: "matchContainsAbsolutePlacements", operator: "CONTAINS", valueJson: [8], sortOrder: 2 }
          ],
          actions: [
            {
              id: "a4",
              actionType: "TRANSFER",
              amountVnd: 10000,
              sourceSelectorType: "PLAYER_BY_ABSOLUTE_PLACEMENT",
              sourceSelectorJson: { placement: 8 },
              destinationSelectorType: "BEST_PARTICIPANT",
              destinationSelectorJson: {},
              descriptionTemplate: "top8",
              sortOrder: 1
            }
          ]
        }
      ]
    };
  }

  if (participantCount === 4) {
    return {
      id: "v4",
      ruleSetId: "rs",
      versionNo,
      participantCountMin: 4,
      participantCountMax: 4,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
      isActive: true,
      summaryJson: null,
      createdAt: new Date().toISOString(),
      rules: [
        {
          id: "r4",
          code: "MS4_BASE",
          name: "4P Base",
          description: null,
          ruleKind: "BASE_RELATIVE_RANK",
          priority: 100,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadata: null,
          conditions: [{ id: "x1", conditionKey: "participantCount", operator: "EQ", valueJson: 4, sortOrder: 1 }],
          actions: [
            { id: "x2", actionType: "TRANSFER", amountVnd: 35000, sourceSelectorType: "PLAYER_BY_RELATIVE_RANK", sourceSelectorJson: { relativeRank: 3 }, destinationSelectorType: "PLAYER_BY_RELATIVE_RANK", destinationSelectorJson: { relativeRank: 1 }, descriptionTemplate: "base", sortOrder: 1 },
            { id: "x3", actionType: "TRANSFER", amountVnd: 35000, sourceSelectorType: "PLAYER_BY_RELATIVE_RANK", sourceSelectorJson: { relativeRank: 4 }, destinationSelectorType: "PLAYER_BY_RELATIVE_RANK", destinationSelectorJson: { relativeRank: 1 }, descriptionTemplate: "base", sortOrder: 2 },
            { id: "x4", actionType: "TRANSFER", amountVnd: 15000, sourceSelectorType: "PLAYER_BY_RELATIVE_RANK", sourceSelectorJson: { relativeRank: 3 }, destinationSelectorType: "PLAYER_BY_RELATIVE_RANK", destinationSelectorJson: { relativeRank: 2 }, descriptionTemplate: "base", sortOrder: 3 },
            { id: "x5", actionType: "TRANSFER", amountVnd: 15000, sourceSelectorType: "PLAYER_BY_RELATIVE_RANK", sourceSelectorJson: { relativeRank: 4 }, destinationSelectorType: "PLAYER_BY_RELATIVE_RANK", destinationSelectorJson: { relativeRank: 2 }, descriptionTemplate: "base", sortOrder: 4 }
          ]
        },
        {
          id: "r5",
          code: "TOP1_TOP2",
          name: "top1-top2",
          description: null,
          ruleKind: "PAIR_CONDITION_MODIFIER",
          priority: 200,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadata: null,
          conditions: [
            { id: "x6", conditionKey: "participantCount", operator: "EQ", valueJson: 4, sortOrder: 1 },
            { id: "x7", conditionKey: "matchContainsAbsolutePlacements", operator: "CONTAINS", valueJson: [1, 2], sortOrder: 2 }
          ],
          actions: [
            { id: "x8", actionType: "TRANSFER", amountVnd: 10000, sourceSelectorType: "PLAYER_BY_ABSOLUTE_PLACEMENT", sourceSelectorJson: { placement: 2 }, destinationSelectorType: "PLAYER_BY_ABSOLUTE_PLACEMENT", destinationSelectorJson: { placement: 1 }, descriptionTemplate: "top1-top2", sortOrder: 1 }
          ]
        },
        {
          id: "r6",
          code: "TOP8",
          name: "top8",
          description: null,
          ruleKind: "ABSOLUTE_PLACEMENT_MODIFIER",
          priority: 300,
          status: "ACTIVE",
          stopProcessingOnMatch: false,
          metadata: null,
          conditions: [
            { id: "x9", conditionKey: "participantCount", operator: "EQ", valueJson: 4, sortOrder: 1 },
            { id: "x10", conditionKey: "matchContainsAbsolutePlacements", operator: "CONTAINS", valueJson: [8], sortOrder: 2 }
          ],
          actions: [
            { id: "x11", actionType: "TRANSFER", amountVnd: 10000, sourceSelectorType: "PLAYER_BY_ABSOLUTE_PLACEMENT", sourceSelectorJson: { placement: 8 }, destinationSelectorType: "BEST_PARTICIPANT", destinationSelectorJson: {}, descriptionTemplate: "top8", sortOrder: 1 }
          ]
        }
      ]
    };
  }

  return {
    id: "vgf",
    ruleSetId: "rs",
    versionNo,
    participantCountMin: 3,
    participantCountMax: 3,
    effectiveFrom: new Date().toISOString(),
    effectiveTo: null,
    isActive: true,
    summaryJson: null,
    createdAt: new Date().toISOString(),
    rules: [
      {
        id: "gf1",
        code: "GF_R2",
        name: "rank2 fund",
        description: null,
        ruleKind: "FUND_CONTRIBUTION",
        priority: 100,
        status: "ACTIVE",
        stopProcessingOnMatch: false,
        metadata: null,
        conditions: [
          { id: "g1", conditionKey: "participantCount", operator: "EQ", valueJson: 3, sortOrder: 1 },
          { id: "g2", conditionKey: "subjectRelativeRank", operator: "EQ", valueJson: 2, sortOrder: 2 }
        ],
        actions: [
          { id: "g3", actionType: "POST_TO_FUND", amountVnd: 10000, sourceSelectorType: "SUBJECT_PLAYER", sourceSelectorJson: {}, destinationSelectorType: "FUND_ACCOUNT", destinationSelectorJson: {}, descriptionTemplate: "rank2", sortOrder: 1 }
        ]
      },
      {
        id: "gf2",
        code: "GF_R3",
        name: "rank3 fund",
        description: null,
        ruleKind: "FUND_CONTRIBUTION",
        priority: 110,
        status: "ACTIVE",
        stopProcessingOnMatch: false,
        metadata: null,
        conditions: [
          { id: "g4", conditionKey: "participantCount", operator: "EQ", valueJson: 3, sortOrder: 1 },
          { id: "g5", conditionKey: "subjectRelativeRank", operator: "EQ", valueJson: 3, sortOrder: 2 }
        ],
        actions: [
          { id: "g6", actionType: "POST_TO_FUND", amountVnd: 20000, sourceSelectorType: "SUBJECT_PLAYER", sourceSelectorJson: {}, destinationSelectorType: "FUND_ACCOUNT", destinationSelectorJson: {}, descriptionTemplate: "rank3", sortOrder: 1 }
        ]
      }
    ]
  };
}

describe("rule engine", () => {
  it("calculates Match Stakes 3-player base + top1-top2 + top8", async () => {
    const engine = new RuleEngineService(accountHelper as any);

    const context = RuleEngineService.buildContext({
      groupId: "g",
      module: "MATCH_STAKES",
      participantCount: 3,
      playedAt: new Date().toISOString(),
      participants: [
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p2", tftPlacement: 2 },
        { playerId: "p3", tftPlacement: 8 }
      ],
      version: buildRuleVersion(1, 3) as any
    });

    const evaluated = await engine.evaluate(context);

    expect(evaluated.lines).toHaveLength(4);
    expect(evaluated.summary.netByPlayer.p1).toBe(120000);
    expect(evaluated.summary.netByPlayer.p2).toBe(-60000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-60000);
  });

  it("calculates Match Stakes 4-player baseline with modifiers", async () => {
    const engine = new RuleEngineService(accountHelper as any);

    const context = RuleEngineService.buildContext({
      groupId: "g",
      module: "MATCH_STAKES",
      participantCount: 4,
      playedAt: new Date().toISOString(),
      participants: [
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p2", tftPlacement: 2 },
        { playerId: "p3", tftPlacement: 5 },
        { playerId: "p4", tftPlacement: 8 }
      ],
      version: buildRuleVersion(2, 4) as any
    });

    const evaluated = await engine.evaluate(context);

    expect(evaluated.lines).toHaveLength(6);
    expect(evaluated.summary.netByPlayer.p1).toBe(90000);
    expect(evaluated.summary.netByPlayer.p2).toBe(20000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-50000);
    expect(evaluated.summary.netByPlayer.p4).toBe(-60000);
  });

  it("does not trigger top8 when absolute placement 8 is absent", async () => {
    const engine = new RuleEngineService(accountHelper as any);

    const context = RuleEngineService.buildContext({
      groupId: "g",
      module: "MATCH_STAKES",
      participantCount: 3,
      playedAt: new Date().toISOString(),
      participants: [
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p2", tftPlacement: 2 },
        { playerId: "p3", tftPlacement: 3 }
      ],
      version: buildRuleVersion(1, 3) as any
    });

    const evaluated = await engine.evaluate(context);
    expect(evaluated.lines).toHaveLength(3);
  });

  it("calculates Group Fund 3-player baseline contributions", async () => {
    const engine = new RuleEngineService(accountHelper as any);

    const context = RuleEngineService.buildContext({
      groupId: "g",
      module: "GROUP_FUND",
      participantCount: 3,
      playedAt: new Date().toISOString(),
      participants: [
        { playerId: "p1", tftPlacement: 1 },
        { playerId: "p2", tftPlacement: 3 },
        { playerId: "p3", tftPlacement: 6 }
      ],
      version: buildRuleVersion(1, 99) as any
    });

    const evaluated = await engine.evaluate(context);

    expect(evaluated.lines).toHaveLength(2);
    expect(evaluated.summary.totalFundInVnd).toBe(30000);
    expect(evaluated.summary.netByPlayer.p2).toBe(-10000);
    expect(evaluated.summary.netByPlayer.p3).toBe(-20000);
  });
});
