import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchStakesService } from "../src/modules/match-stakes/match-stakes-service.js";

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

const openPeriod = {
  id: "90000000-0000-4000-8000-000000000001",
  groupId: "group-1",
  periodNo: 1,
  title: "Period 1",
  note: null,
  status: "OPEN" as const,
  openedAt: "2026-01-01T00:00:00.000Z",
  closedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function createFixture() {
  const repositories = {
    ledgers: {
      getMatchStakesSummary: vi.fn()
    },
    matches: {
      list: vi.fn()
    },
    players: {
      findActiveByIds: vi.fn()
    },
    audits: {
      insert: vi.fn().mockResolvedValue(undefined)
    },
    matchStakesDebt: {
      getCurrentOpenPeriod: vi.fn(),
      getPeriodById: vi.fn(),
      listPeriods: vi.fn(),
      listPeriodPlayerAggregates: vi.fn(),
      countNonVoidedMatchesInPeriod: vi.fn(),
      listSettlementsWithLines: vi.fn(),
      createOpenPeriod: vi.fn(),
      createSettlement: vi.fn(),
      insertSettlementLines: vi.fn(),
      closeOpenPeriod: vi.fn()
    }
  } as any;

  const txRepositories = {
    ...repositories
  } as any;

  withTransactionMock.mockImplementation(async (_pool: unknown, callback: (tx: unknown) => Promise<unknown>) => callback({}));
  createRepositoriesMock.mockReturnValue(txRepositories);

  const service = new MatchStakesService({} as any, repositories, "group-1");
  return { service, repositories, txRepositories };
}

describe("match-stakes debt period service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns current open debt period summary", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getCurrentOpenPeriod.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 3,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 40000
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 3,
        accruedNetVnd: -100000,
        settledPaidVnd: 40000,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(3);

    const result = await service.getCurrentDebtPeriod();

    expect(result.period.id).toBe(openPeriod.id);
    expect(result.summary.totalMatches).toBe(3);
    expect(result.summary.totalOutstandingReceiveVnd).toBe(60000);
    expect(result.summary.totalOutstandingPayVnd).toBe(60000);
    expect(result.players[0]?.playerName).toBe("An");
    expect(result.players[0]?.outstandingNetVnd).toBe(60000);
  });

  it("lists and expands debt periods with cumulative totals", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.listPeriods.mockResolvedValue({
      items: [
        openPeriod,
        {
          ...openPeriod,
          id: "90000000-0000-4000-8000-000000000002",
          periodNo: 2,
          status: "CLOSED",
          closedAt: "2026-02-01T00:00:00.000Z"
        }
      ],
      total: 2
    });
    repositories.matchStakesDebt.listPeriodPlayerAggregates
      .mockResolvedValueOnce([
        {
          playerId: "10000000-0000-4000-8000-000000000001",
          playerName: "An",
          totalMatches: 1,
          accruedNetVnd: 50000,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Binh",
          totalMatches: 1,
          accruedNetVnd: -50000,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        }
      ])
      .mockResolvedValueOnce([
        {
          playerId: "10000000-0000-4000-8000-000000000001",
          playerName: "An",
          totalMatches: 2,
          accruedNetVnd: 0,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        }
      ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const result = await service.listDebtPeriods({ page: 1, pageSize: 20 });

    expect(result.total).toBe(2);
    expect(result.items[0]?.periodNo).toBe(1);
    expect(result.items[0]?.totalOutstandingReceiveVnd).toBe(50000);
    expect(result.items[1]?.status).toBe("CLOSED");
  });

  it("returns period detail with settlements and recent matches", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 50000
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        accruedNetVnd: -100000,
        settledPaidVnd: 50000,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);
    repositories.matchStakesDebt.listSettlementsWithLines.mockResolvedValue([
      {
        id: "settlement-1",
        postedAt: "2026-01-05T00:00:00.000Z",
        note: "paid in cash",
        createdAt: "2026-01-05T00:00:00.000Z",
        updatedAt: "2026-01-05T00:00:00.000Z",
        lines: [
          {
            id: "line-1",
            payerPlayerId: "10000000-0000-4000-8000-000000000002",
            payerPlayerName: "Binh",
            receiverPlayerId: "10000000-0000-4000-8000-000000000001",
            receiverPlayerName: "An",
            amountVnd: 50000,
            note: null,
            createdAt: "2026-01-05T00:00:00.000Z"
          }
        ]
      }
    ]);
    repositories.matches.list.mockResolvedValue({
      items: [
        {
          id: "match-1",
          played_at: "2026-01-04T00:00:00.000Z",
          participant_count: 3,
          status: "POSTED",
          debt_period_id: openPeriod.id,
          debt_period_no: 1
        }
      ],
      total: 1
    });

    const result = await service.getDebtPeriodDetail(openPeriod.id);

    expect(result.period.periodNo).toBe(1);
    expect(result.settlements).toHaveLength(1);
    expect(result.recentMatches).toHaveLength(1);
    expect(result.summary.totalOutstandingReceiveVnd).toBe(50000);
  });

  it("records settlement lines and returns updated summary", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.players.findActiveByIds.mockResolvedValue([
      { id: "10000000-0000-4000-8000-000000000001", displayName: "An" },
      { id: "10000000-0000-4000-8000-000000000002", displayName: "Binh" }
    ]);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates
      .mockResolvedValueOnce([
        {
          playerId: "10000000-0000-4000-8000-000000000001",
          playerName: "An",
          totalMatches: 2,
          accruedNetVnd: 100000,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Binh",
          totalMatches: 2,
          accruedNetVnd: -100000,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        }
      ])
      .mockResolvedValueOnce([
        {
          playerId: "10000000-0000-4000-8000-000000000001",
          playerName: "An",
          totalMatches: 2,
          accruedNetVnd: 100000,
          settledPaidVnd: 0,
          settledReceivedVnd: 50000
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Binh",
          totalMatches: 2,
          accruedNetVnd: -100000,
          settledPaidVnd: 50000,
          settledReceivedVnd: 0
        }
      ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);
    txRepositories.matchStakesDebt.createSettlement.mockResolvedValue({
      id: "settlement-1",
      postedAt: "2026-01-05T00:00:00.000Z",
      note: null,
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z"
    });
    txRepositories.matchStakesDebt.insertSettlementLines.mockResolvedValue([
      {
        id: "line-1",
        settlementId: "settlement-1",
        debtPeriodId: openPeriod.id,
        payerPlayerId: "10000000-0000-4000-8000-000000000002",
        receiverPlayerId: "10000000-0000-4000-8000-000000000001",
        amountVnd: 50000,
        note: null,
        createdAt: "2026-01-05T00:00:00.000Z"
      }
    ]);

    const result = await service.createDebtSettlement(openPeriod.id, {
      lines: [
        {
          payerPlayerId: "10000000-0000-4000-8000-000000000002",
          receiverPlayerId: "10000000-0000-4000-8000-000000000001",
          amountVnd: 50000
        }
      ]
    });

    expect(result.settlement.id).toBe("settlement-1");
    expect(result.summary.totalOutstandingReceiveVnd).toBe(50000);
    expect(result.summary.totalOutstandingPayVnd).toBe(50000);
    expect(result.players[0]?.outstandingNetVnd).toBe(50000);
  });

  it("rejects settlement that overshoots outstanding", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.players.findActiveByIds.mockResolvedValue([
      { id: "10000000-0000-4000-8000-000000000001", displayName: "An" },
      { id: "10000000-0000-4000-8000-000000000002", displayName: "Binh" }
    ]);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        accruedNetVnd: -100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);

    await expect(
      service.createDebtSettlement(openPeriod.id, {
        lines: [
          {
            payerPlayerId: "10000000-0000-4000-8000-000000000002",
            receiverPlayerId: "10000000-0000-4000-8000-000000000001",
            amountVnd: 150000
          }
        ]
      })
    ).rejects.toMatchObject({ code: "DEBT_SETTLEMENT_OVERPAY" });
  });

  it("closes period only when outstanding balances are all zero", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 50000
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);

    await expect(service.closeDebtPeriod(openPeriod.id, {})).rejects.toMatchObject({
      code: "DEBT_PERIOD_OUTSTANDING_NOT_ZERO"
    });
  });

  it("closes period when summary is fully settled", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 100000
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        accruedNetVnd: -100000,
        settledPaidVnd: 100000,
        settledReceivedVnd: 0
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);
    txRepositories.matchStakesDebt.closeOpenPeriod.mockResolvedValue({
      ...openPeriod,
      status: "CLOSED",
      closedAt: "2026-01-10T00:00:00.000Z"
    });

    const result = await service.closeDebtPeriod(openPeriod.id, { note: "all settled" });

    expect(result.status).toBe("CLOSED");
    expect(result.closedAt).toBe("2026-01-10T00:00:00.000Z");
  });
});
