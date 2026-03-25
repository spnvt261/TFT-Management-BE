import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchService } from "../src/modules/matches/match-service.js";

const { withTransactionMock, createRepositoriesMock } = vi.hoisted(() => ({
  withTransactionMock: vi.fn(),
  createRepositoriesMock: vi.fn()
}));

vi.mock("../src/db/postgres/transaction.js", () => ({
  withTransaction: withTransactionMock
}));

vi.mock("../src/db/repositories/repository-factory.js", () => ({
  createRepositories: createRepositoriesMock
}));

const participants = [
  { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
  { playerId: "10000000-0000-4000-8000-000000000002", tftPlacement: 4 },
  { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
];

const activePlayers = [
  { id: "10000000-0000-4000-8000-000000000001", displayName: "An" },
  { id: "10000000-0000-4000-8000-000000000002", displayName: "Binh" },
  { id: "10000000-0000-4000-8000-000000000003", displayName: "Chi" }
];

const baseRuleVersion = {
  id: "30000000-0000-4000-8000-000000000001",
  ruleSetId: "20000000-0000-4000-8000-000000000001",
  versionNo: 1,
  description: "v1",
  participantCountMin: 3,
  participantCountMax: 4,
  effectiveFrom: "2025-01-01T00:00:00.000Z",
  effectiveTo: null,
  isActive: true,
  summaryJson: null,
  builderType: null,
  builderConfig: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  rules: []
};

function createFixture() {
  const repositories = {
    players: {
      findActiveByIds: vi.fn().mockResolvedValue(activePlayers)
    },
    rules: {
      getRuleSetById: vi.fn().mockResolvedValue({
        id: "20000000-0000-4000-8000-000000000001",
        module: "MATCH_STAKES",
        code: "MS_DEFAULT",
        name: "Match Stakes Default",
        description: null,
        status: "ACTIVE",
        isDefault: true,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z"
      }),
      resolveVersionForMatch: vi.fn().mockResolvedValue(baseRuleVersion),
      getRuleSetVersionDetail: vi.fn().mockResolvedValue(baseRuleVersion)
    },
    matches: {
      createMatch: vi.fn().mockResolvedValue({ id: "match-1" }),
      reserveNextPeriodMatchNo: vi.fn().mockResolvedValue(1),
      insertParticipants: vi.fn().mockResolvedValue(undefined),
      upsertNote: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getParticipants: vi.fn().mockResolvedValue([]),
      getNote: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      voidMatch: vi.fn().mockResolvedValue(undefined)
    },
    settlements: {
      createSettlement: vi.fn().mockResolvedValue({ id: "settlement-1" }),
      insertSettlementLines: vi.fn().mockResolvedValue(undefined),
      getSettlementWithLines: vi.fn().mockResolvedValue(null)
    },
    ledgers: {
      createBatch: vi.fn().mockResolvedValue({ id: "batch-1" }),
      getInsertedSettlementLineIds: vi.fn().mockResolvedValue(["line-1", "line-2", "line-3"]),
      insertEntries: vi.fn().mockResolvedValue(undefined),
      getEntriesByMatch: vi.fn().mockResolvedValue([])
    },
    presets: {
      upsert: vi.fn().mockResolvedValue(undefined)
    },
    audits: {
      insert: vi.fn().mockResolvedValue(undefined)
    },
    matchStakesDebt: {
      getOrCreateOpenPeriod: vi.fn().mockResolvedValue({
        id: "debt-period-1",
        groupId: "group-1",
        periodNo: 1,
        title: null,
        note: null,
        closeNote: null,
        nextPeriodId: null,
        status: "OPEN",
        openedAt: "2025-01-01T00:00:00.000Z",
        closedAt: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z"
      })
    },
    accounts: {
      getOrCreatePlayerAccount: vi.fn().mockImplementation(async (_groupId: string, playerId: string) => ({
        accountId: `acc-${playerId.slice(-4)}`,
        playerId
      })),
      getOrCreateFundAccount: vi.fn().mockResolvedValue({ accountId: "acc-fund", playerId: null })
    }
  } as any;

  const txRepositories = {
    ...repositories,
    rules: {
      ...repositories.rules
    }
  } as any;

  withTransactionMock.mockImplementation(async (_pool: unknown, callback: (tx: unknown) => Promise<unknown>) => callback({}));
  createRepositoriesMock.mockReturnValue(txRepositories);

  const service = new MatchService({} as any, repositories, "group-1");
  return { service, repositories, txRepositories };
}

describe("match preview/create two-step flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preview success for MATCH_STAKES with 3 participants", async () => {
    const { service } = createFixture();

    const result = await service.previewMatch({
      module: "MATCH_STAKES",
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      participants
    });

    expect(result.ruleSetVersion.id).toBe(baseRuleVersion.id);
    expect(result.participants).toHaveLength(3);
    expect(result.participants[0]?.relativeRank).toBe(1);
    expect(result.settlementPreview.engineVersion).toBe("v1");
  });

  it("preview success for GROUP_FUND", async () => {
    const { service, repositories } = createFixture();
    repositories.rules.getRuleSetById.mockResolvedValueOnce({
      id: "20000000-0000-4000-8000-000000000002",
      module: "GROUP_FUND",
      code: "GF_DEFAULT",
      name: "Group Fund Default",
      description: null,
      status: "ACTIVE",
      isDefault: true,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z"
    });

    const result = await service.previewMatch({
      module: "GROUP_FUND",
      ruleSetId: "20000000-0000-4000-8000-000000000002",
      participants
    });

    expect(result.module).toBe("GROUP_FUND");
    expect(result.participants).toHaveLength(3);
  });

  it("preview fails on duplicate player", async () => {
    const { service } = createFixture();

    await expect(
      service.previewMatch({
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        participants: [
          { playerId: participants[0]!.playerId, tftPlacement: 1 },
          { playerId: participants[0]!.playerId, tftPlacement: 4 },
          { playerId: participants[2]!.playerId, tftPlacement: 8 }
        ]
      })
    ).rejects.toMatchObject({ code: "MATCH_DUPLICATE_PLAYER" });
  });

  it("preview fails on duplicate placement", async () => {
    const { service } = createFixture();

    await expect(
      service.previewMatch({
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        participants: [
          { playerId: participants[0]!.playerId, tftPlacement: 1 },
          { playerId: participants[1]!.playerId, tftPlacement: 1 },
          { playerId: participants[2]!.playerId, tftPlacement: 8 }
        ]
      })
    ).rejects.toMatchObject({ code: "MATCH_DUPLICATE_PLACEMENT" });
  });

  it("preview fails when no applicable version exists", async () => {
    const { service, repositories } = createFixture();
    repositories.rules.resolveVersionForMatch.mockResolvedValueOnce(null);

    await expect(
      service.previewMatch({
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        participants
      })
    ).rejects.toMatchObject({ code: "RULE_SET_VERSION_NOT_APPLICABLE" });
  });

  it("create success in ENGINE mode", async () => {
    const { service, txRepositories } = createFixture();
    vi.spyOn(service, "getMatchDetail").mockResolvedValue({ id: "match-1", confirmationMode: "ENGINE" } as any);

    const result = await service.createMatch({
      module: "MATCH_STAKES",
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
      participants
    });

    expect(result.id).toBe("match-1");
    expect(txRepositories.matchStakesDebt.getOrCreateOpenPeriod).toHaveBeenCalledWith("group-1");
    expect(txRepositories.matches.createMatch).toHaveBeenCalledTimes(1);
    expect(txRepositories.matches.createMatch.mock.calls[0]?.[0]?.debtPeriodId).toBe("debt-period-1");
    expect(txRepositories.settlements.createSettlement.mock.calls[0]?.[0]?.resultSnapshot?.confirmationMode).toBe("ENGINE");
  });

  it("create GROUP_FUND does not attach to match-stakes debt period", async () => {
    const { service, repositories, txRepositories } = createFixture();
    repositories.rules.getRuleSetById.mockResolvedValueOnce({
      id: "20000000-0000-4000-8000-000000000002",
      module: "GROUP_FUND",
      code: "GF_DEFAULT",
      name: "Group Fund Default",
      description: null,
      status: "ACTIVE",
      isDefault: true,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z"
    });
    vi.spyOn(service, "getMatchDetail").mockResolvedValue({ id: "match-1", confirmationMode: "ENGINE" } as any);

    await service.createMatch({
      module: "GROUP_FUND",
      ruleSetId: "20000000-0000-4000-8000-000000000002",
      ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
      participants
    });

    expect(txRepositories.matchStakesDebt.getOrCreateOpenPeriod).not.toHaveBeenCalled();
    expect(txRepositories.matches.createMatch.mock.calls[0]?.[0]?.debtPeriodId).toBeNull();
  });

  it("create success in MANUAL_ADJUSTED mode", async () => {
    const { service, txRepositories } = createFixture();
    vi.spyOn(service, "getMatchDetail").mockResolvedValue({ id: "match-1", confirmationMode: "MANUAL_ADJUSTED" } as any);

    await service.createMatch({
      module: "MATCH_STAKES",
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
      participants,
      confirmation: {
        mode: "MANUAL_ADJUSTED",
        participantNets: [
          { playerId: participants[0]!.playerId, netVnd: 100000 },
          { playerId: participants[1]!.playerId, netVnd: -40000 },
          { playerId: participants[2]!.playerId, netVnd: -60000 }
        ],
        overrideReason: "manual fix"
      }
    });

    const insertedLines = txRepositories.settlements.insertSettlementLines.mock.calls[0]?.[2] ?? [];
    expect(insertedLines.length).toBeGreaterThan(0);
    expect(insertedLines.every((line: { ruleCode: string }) => line.ruleCode === "MANUAL_OVERRIDE")).toBe(true);
  });

  it("manual adjusted MATCH_STAKES fails when participant net sum != 0", async () => {
    const { service } = createFixture();

    await expect(
      service.createMatch({
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
        participants,
        confirmation: {
          mode: "MANUAL_ADJUSTED",
          participantNets: [
            { playerId: participants[0]!.playerId, netVnd: 100000 },
            { playerId: participants[1]!.playerId, netVnd: -40000 },
            { playerId: participants[2]!.playerId, netVnd: -50000 }
          ]
        }
      })
    ).rejects.toMatchObject({ code: "MATCH_CONFIRMATION_INVALID" });
  });

  it("manual adjusted payload fails when participant nets do not match participants exactly", async () => {
    const { service } = createFixture();

    await expect(
      service.createMatch({
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
        participants,
        confirmation: {
          mode: "MANUAL_ADJUSTED",
          participantNets: [
            { playerId: participants[0]!.playerId, netVnd: 100000 },
            { playerId: participants[1]!.playerId, netVnd: -100000 }
          ]
        }
      })
    ).rejects.toMatchObject({ code: "MATCH_CONFIRMATION_INVALID" });
  });

  it("created match persists engine snapshot and final confirmed snapshot", async () => {
    const { service, txRepositories } = createFixture();
    vi.spyOn(service, "getMatchDetail").mockResolvedValue({ id: "match-1" } as any);

    await service.createMatch({
      module: "MATCH_STAKES",
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
      participants,
      confirmation: {
        mode: "MANUAL_ADJUSTED",
        participantNets: [
          { playerId: participants[0]!.playerId, netVnd: 100000 },
          { playerId: participants[1]!.playerId, netVnd: -50000 },
          { playerId: participants[2]!.playerId, netVnd: -50000 }
        ],
        overrideReason: "audit test"
      }
    });

    const matchInsertArg = txRepositories.matches.createMatch.mock.calls[0]?.[0];
    const settlementInsertArg = txRepositories.settlements.createSettlement.mock.calls[0]?.[0];

    expect(matchInsertArg?.calculationSnapshot?.originalEngineResult).toBeTruthy();
    expect(settlementInsertArg?.resultSnapshot?.confirmationMode).toBe("MANUAL_ADJUSTED");
    expect(settlementInsertArg?.resultSnapshot?.confirmedParticipantNets).toHaveLength(3);
  });

  it("ledger entries reflect final confirmed result, not only original engine result", async () => {
    const { service, txRepositories } = createFixture();
    vi.spyOn(service, "getMatchDetail").mockResolvedValue({ id: "match-1" } as any);

    await service.createMatch({
      module: "MATCH_STAKES",
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
      participants,
      confirmation: {
        mode: "MANUAL_ADJUSTED",
        participantNets: [
          { playerId: participants[0]!.playerId, netVnd: 120000 },
          { playerId: participants[1]!.playerId, netVnd: -50000 },
          { playerId: participants[2]!.playerId, netVnd: -70000 }
        ]
      }
    });

    const postingEntries = txRepositories.ledgers.insertEntries.mock.calls[0]?.[2] ?? [];
    const postedAmount = postingEntries.reduce((sum: number, item: { amountVnd: number }) => sum + item.amountVnd, 0);

    expect(postingEntries.length).toBeGreaterThan(0);
    expect(postedAmount).toBe(120000);
  });
});
