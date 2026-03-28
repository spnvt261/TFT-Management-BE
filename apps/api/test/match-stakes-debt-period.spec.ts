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
  closeNote: null,
  nextPeriodId: null,
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
      listNonVoidedPeriodMatches: vi.fn(),
      listMatchParticipantsByMatchIds: vi.fn(),
      listSettlementsWithLines: vi.fn(),
      createOpenPeriod: vi.fn(),
      createSettlement: vi.fn(),
      insertSettlementLines: vi.fn(),
      closeOpenPeriod: vi.fn(),
      replacePeriodInitBalances: vi.fn(),
      setNextPeriodId: vi.fn()
    },
    historyEvents: {
      listMatchStakesHistory: vi.fn(),
      listMatchStakesPeriodEvents: vi.fn().mockResolvedValue([]),
      listMatchStakesPeriodEventImpacts: vi.fn().mockResolvedValue([]),
      createEvent: vi.fn(),
      insertMatchStakesImpacts: vi.fn(),
      getEventById: vi.fn(),
      markEventReset: vi.fn()
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
        initNetVnd: 5000,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 40000
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 3,
        initNetVnd: -5000,
        accruedNetVnd: -100000,
        settledPaidVnd: 40000,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(3);

    const result = await service.getCurrentDebtPeriod();

    expect(result.period.id).toBe(openPeriod.id);
    expect(result.summary.totalMatches).toBe(3);
    expect(result.summary.totalOutstandingReceiveVnd).toBe(65000);
    expect(result.summary.totalOutstandingPayVnd).toBe(65000);
    expect(result.players[0]?.playerName).toBe("An");
    expect(result.players[0]?.initNetVnd).toBe(5000);
    expect(result.players[0]?.outstandingNetVnd).toBe(65000);
  });

  it("separates match-only, advance-only, and combined nets in player summary", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getCurrentOpenPeriod.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        initNetVnd: 0,
        accruedMatchNetVnd: 100000,
        accruedAdvanceNetVnd: 30000,
        accruedNetVnd: 130000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        initNetVnd: 0,
        accruedMatchNetVnd: -100000,
        accruedAdvanceNetVnd: -30000,
        accruedNetVnd: -130000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);

    const result = await service.getCurrentDebtPeriod();
    const an = result.players.find((item) => item.playerId === "10000000-0000-4000-8000-000000000001");
    const binh = result.players.find((item) => item.playerId === "10000000-0000-4000-8000-000000000002");

    expect(an?.matchNetVnd).toBe(100000);
    expect(an?.advanceNetVnd).toBe(30000);
    expect(an?.combinedNetVnd).toBe(130000);
    expect(an?.outstandingCombinedNetVnd).toBe(130000);

    expect(binh?.matchNetVnd).toBe(-100000);
    expect(binh?.advanceNetVnd).toBe(-30000);
    expect(binh?.combinedNetVnd).toBe(-130000);
    expect(binh?.outstandingCombinedNetVnd).toBe(-130000);

    expect(result.summary.totalMatchNetReceiveVnd).toBe(100000);
    expect(result.summary.totalAdvanceNetReceiveVnd).toBe(30000);
    expect(result.summary.totalCombinedNetReceiveVnd).toBe(130000);
  });

  it("supports advance-only period where match-only stays zero", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getCurrentOpenPeriod.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 0,
        initNetVnd: 0,
        accruedMatchNetVnd: 0,
        accruedAdvanceNetVnd: 37500,
        accruedNetVnd: 37500,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 0,
        initNetVnd: 0,
        accruedMatchNetVnd: 0,
        accruedAdvanceNetVnd: -37500,
        accruedNetVnd: -37500,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(0);

    const result = await service.getCurrentDebtPeriod();
    const an = result.players.find((item) => item.playerId === "10000000-0000-4000-8000-000000000001");

    expect(an?.matchNetVnd).toBe(0);
    expect(an?.advanceNetVnd).toBe(37500);
    expect(an?.combinedNetVnd).toBe(37500);
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
          initNetVnd: 0,
        accruedNetVnd: 50000,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Binh",
          totalMatches: 1,
          initNetVnd: 0,
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
          initNetVnd: 0,
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
        initNetVnd: 0,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 50000
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        initNetVnd: 0,
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

  it("returns debt-period timeline newest-first with initial snapshot", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        initNetVnd: 0,
        accruedNetVnd: 300000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        initNetVnd: 0,
        accruedNetVnd: -150000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000003",
        playerName: "Chi",
        totalMatches: 2,
        initNetVnd: 0,
        accruedNetVnd: -150000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000004",
        playerName: "Dung",
        totalMatches: 0,
        initNetVnd: 0,
        accruedNetVnd: 0,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);
    repositories.matchStakesDebt.listNonVoidedPeriodMatches.mockResolvedValue([
      {
        id: "match-1",
        playedAt: "2026-01-01T00:00:00.000Z",
        participantCount: 3,
        status: "POSTED",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "match-2",
        playedAt: "2026-01-02T00:00:00.000Z",
        participantCount: 3,
        status: "POSTED",
        createdAt: "2026-01-02T00:00:00.000Z"
      }
    ]);
    repositories.matchStakesDebt.listMatchParticipantsByMatchIds.mockResolvedValue([
      {
        matchId: "match-1",
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        tftPlacement: 1,
        relativeRank: 1,
        settlementNetVnd: 100000
      },
      {
        matchId: "match-1",
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        tftPlacement: 2,
        relativeRank: 2,
        settlementNetVnd: -50000
      },
      {
        matchId: "match-1",
        playerId: "10000000-0000-4000-8000-000000000003",
        playerName: "Chi",
        tftPlacement: 3,
        relativeRank: 3,
        settlementNetVnd: -50000
      },
      {
        matchId: "match-2",
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        tftPlacement: 1,
        relativeRank: 1,
        settlementNetVnd: 200000
      },
      {
        matchId: "match-2",
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        tftPlacement: 2,
        relativeRank: 2,
        settlementNetVnd: -100000
      },
      {
        matchId: "match-2",
        playerId: "10000000-0000-4000-8000-000000000003",
        playerName: "Chi",
        tftPlacement: 3,
        relativeRank: 3,
        settlementNetVnd: -100000
      }
    ]);

    const result = await service.getDebtPeriodTimeline(openPeriod.id);

    expect(result.currentPlayers).toHaveLength(4);
    expect(result.timeline).toHaveLength(3);
    expect(result.timeline[0]?.type).toBe("MATCH");
    expect(result.timeline[0]?.matchId).toBe("match-2");
    expect(result.timeline[0]?.matchNo).toBe(2);
    expect(result.timeline[1]?.matchId).toBe("match-1");
    expect(result.timeline[2]?.type).toBe("INITIAL");

    const latestByPlayer = new Map(result.timeline[0]?.rows.map((row) => [row.playerId, row]));
    expect(latestByPlayer.get("10000000-0000-4000-8000-000000000001")?.cumulativeNetVnd).toBe(300000);
    expect(latestByPlayer.get("10000000-0000-4000-8000-000000000002")?.cumulativeNetVnd).toBe(-150000);
    expect(latestByPlayer.get("10000000-0000-4000-8000-000000000003")?.cumulativeNetVnd).toBe(-150000);
    expect(latestByPlayer.get("10000000-0000-4000-8000-000000000004")?.cumulativeNetVnd).toBe(0);
    expect(latestByPlayer.get("10000000-0000-4000-8000-000000000004")?.tftPlacement).toBeNull();

    const initialByPlayer = new Map(result.timeline[2]?.rows.map((row) => [row.playerId, row]));
    expect(initialByPlayer.get("10000000-0000-4000-8000-000000000001")?.cumulativeNetVnd).toBe(0);
    expect(initialByPlayer.get("10000000-0000-4000-8000-000000000002")?.cumulativeNetVnd).toBe(0);
    expect(initialByPlayer.get("10000000-0000-4000-8000-000000000003")?.cumulativeNetVnd).toBe(0);
    expect(initialByPlayer.get("10000000-0000-4000-8000-000000000004")?.cumulativeNetVnd).toBe(0);
  });

  it("omits initial snapshot when includeInitialSnapshot=false", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 1,
        initNetVnd: 0,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(1);
    repositories.matchStakesDebt.listNonVoidedPeriodMatches.mockResolvedValue([
      {
        id: "match-1",
        playedAt: "2026-01-01T00:00:00.000Z",
        participantCount: 3,
        status: "POSTED",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    repositories.matchStakesDebt.listMatchParticipantsByMatchIds.mockResolvedValue([
      {
        matchId: "match-1",
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        tftPlacement: 1,
        relativeRank: 1,
        settlementNetVnd: 100000
      }
    ]);

    const result = await service.getDebtPeriodTimeline(openPeriod.id, { includeInitialSnapshot: false });

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]?.type).toBe("MATCH");
  });

  it("keeps RESET advance row visible but excludes it from active cumulative advance debt", async () => {
    const { service, repositories } = createFixture();
    repositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    repositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 1,
        initNetVnd: 0,
        accruedMatchNetVnd: 100000,
        accruedAdvanceNetVnd: 0,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 1,
        initNetVnd: 0,
        accruedMatchNetVnd: -100000,
        accruedAdvanceNetVnd: 0,
        accruedNetVnd: -100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    repositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(1);
    repositories.matchStakesDebt.listNonVoidedPeriodMatches.mockResolvedValue([
      {
        id: "match-1",
        playedAt: "2026-01-01T00:00:00.000Z",
        participantCount: 2,
        status: "POSTED",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    repositories.matchStakesDebt.listMatchParticipantsByMatchIds.mockResolvedValue([
      {
        matchId: "match-1",
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        tftPlacement: 1,
        relativeRank: 1,
        settlementNetVnd: 100000
      },
      {
        matchId: "match-1",
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        tftPlacement: 2,
        relativeRank: 2,
        settlementNetVnd: -100000
      }
    ]);
    repositories.historyEvents.listMatchStakesPeriodEvents.mockResolvedValue([
      {
        id: "event-reset-advance",
        eventType: "MATCH_STAKES_ADVANCE",
        eventStatus: "RESET",
        resetAt: "2026-01-03T00:00:00.000Z",
        resetReason: "wrong advance",
        postedAt: "2026-01-03T00:00:00.000Z",
        createdAt: "2026-01-03T00:00:00.000Z",
        amountVnd: 50000,
        note: "advance reset",
        impactMode: "AFFECTS_DEBT",
        affectsDebt: true,
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        outstandingBeforeVnd: 100000,
        outstandingAfterVnd: 150000,
        metadata: {}
      }
    ]);
    repositories.historyEvents.listMatchStakesPeriodEventImpacts.mockResolvedValue([]);

    const result = await service.getDebtPeriodTimeline(openPeriod.id);
    const advanceRow = result.timeline.find((item) => item.type === "ADVANCE");
    expect(advanceRow).toBeTruthy();
    expect(advanceRow?.eventStatus).toBe("RESET");
    expect(advanceRow?.debtImpactBucket).toBe("ADVANCE");
    expect(advanceRow?.debtImpactActive).toBe(false);

    const an = advanceRow?.rows.find((row) => row.playerId === "10000000-0000-4000-8000-000000000001");
    expect(an?.matchDeltaVnd).toBe(0);
    expect(an?.advanceDeltaVnd).toBe(0);
    expect(an?.cumulativeMatchNetVnd).toBe(100000);
    expect(an?.cumulativeAdvanceNetVnd).toBe(0);
    expect(an?.cumulativeCombinedNetVnd).toBe(100000);
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
          initNetVnd: 0,
        accruedNetVnd: 100000,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Binh",
          totalMatches: 2,
          initNetVnd: 0,
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
          initNetVnd: 0,
        accruedNetVnd: 100000,
          settledPaidVnd: 0,
          settledReceivedVnd: 50000
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Binh",
          totalMatches: 2,
          initNetVnd: 0,
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
        initNetVnd: 0,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        initNetVnd: 0,
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

  it("rejects close when carry-forward balances do not net to zero", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        initNetVnd: 0,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 50000
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);

    await expect(
      service.closeDebtPeriod(openPeriod.id, {
        closingBalances: [{ playerId: "10000000-0000-4000-8000-000000000001", netVnd: 1000 }]
      })
    ).rejects.toMatchObject({
      code: "DEBT_PERIOD_CLOSING_BALANCE_INVALID"
    });
  });

  it("closes period and creates next open period with carry-forward init balances", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "An",
        totalMatches: 2,
        initNetVnd: 0,
        accruedNetVnd: 100000,
        settledPaidVnd: 0,
        settledReceivedVnd: 50000
      },
      {
        playerId: "10000000-0000-4000-8000-000000000002",
        playerName: "Binh",
        totalMatches: 2,
        initNetVnd: 0,
        accruedNetVnd: -100000,
        settledPaidVnd: 50000,
        settledReceivedVnd: 0
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(2);
    txRepositories.matchStakesDebt.closeOpenPeriod.mockResolvedValue({
      ...openPeriod,
      status: "CLOSED",
      closedAt: "2026-01-10T00:00:00.000Z"
    });
    txRepositories.matchStakesDebt.createOpenPeriod.mockResolvedValue({
      ...openPeriod,
      id: "90000000-0000-4000-8000-000000000099",
      periodNo: 2,
      title: null,
      note: null
    });
    txRepositories.matchStakesDebt.replacePeriodInitBalances.mockResolvedValue(undefined);
    txRepositories.matchStakesDebt.setNextPeriodId.mockResolvedValue(undefined);

    const result = await service.closeDebtPeriod(openPeriod.id, {
      note: "carry 50",
      closingBalances: [
        { playerId: "10000000-0000-4000-8000-000000000001", netVnd: 50000 },
        { playerId: "10000000-0000-4000-8000-000000000002", netVnd: -50000 }
      ]
    });

    expect(result.status).toBe("CLOSED");
    expect(result.closedAt).toBe("2026-01-10T00:00:00.000Z");
    expect(result.nextPeriod.periodNo).toBe(2);
    expect(result.carryForwardBalances).toHaveLength(2);
    expect(txRepositories.matchStakesDebt.replacePeriodInitBalances).toHaveBeenCalledWith(
      "90000000-0000-4000-8000-000000000099",
      [
        { playerId: "10000000-0000-4000-8000-000000000001", initNetVnd: 50000 },
        { playerId: "10000000-0000-4000-8000-000000000002", initNetVnd: -50000 }
      ]
    );
  });

  it("splits AFFECTS_DEBT advance across all selected participants including advancer", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getCurrentOpenPeriod.mockResolvedValue(openPeriod);
    txRepositories.players.findActiveByIds.mockImplementation(async (_groupId: string, ids: string[]) =>
      ids.map((id) => ({ id, displayName: `Player-${id.slice(-4)}` }))
    );
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates
      .mockResolvedValueOnce([
        {
          playerId: "10000000-0000-4000-8000-000000000001",
          playerName: "Player-0001",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: 0,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Player-0002",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: 0,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000003",
          playerName: "Player-0003",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: 0,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000004",
          playerName: "Player-0004",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: 0,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        }
      ])
      .mockResolvedValueOnce([
        {
          playerId: "10000000-0000-4000-8000-000000000001",
          playerName: "Player-0001",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: 37500,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000002",
          playerName: "Player-0002",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: -12500,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000003",
          playerName: "Player-0003",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: -12500,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        },
        {
          playerId: "10000000-0000-4000-8000-000000000004",
          playerName: "Player-0004",
          totalMatches: 0,
          initNetVnd: 0,
          accruedNetVnd: -12500,
          settledPaidVnd: 0,
          settledReceivedVnd: 0
        }
      ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(0);
    txRepositories.historyEvents.createEvent.mockImplementation(async (input: any) => ({
      id: "event-1",
      eventType: input.eventType,
      eventStatus: "ACTIVE",
      resetAt: null,
      resetReason: null,
      postedAt: input.postedAt,
      createdAt: "2026-01-01T00:00:00.000Z",
      note: input.note,
      amountVnd: input.amountVnd,
      playerId: input.playerId,
      secondaryPlayerId: input.secondaryPlayerId,
      debtPeriodId: input.debtPeriodId,
      ledgerBatchId: input.ledgerBatchId,
      balanceBeforeVnd: input.balanceBeforeVnd,
      balanceAfterVnd: input.balanceAfterVnd,
      outstandingBeforeVnd: input.outstandingBeforeVnd,
      outstandingAfterVnd: input.outstandingAfterVnd,
      metadataJson: input.metadataJson
    }));
    txRepositories.historyEvents.insertMatchStakesImpacts.mockResolvedValue(undefined);

    const result = await service.createHistoryEvent({
      eventType: "MATCH_STAKES_ADVANCE",
      playerId: "10000000-0000-4000-8000-000000000001",
      amountVnd: 50000,
      impactMode: "AFFECTS_DEBT",
      participantPlayerIds: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000002",
        "10000000-0000-4000-8000-000000000003",
        "10000000-0000-4000-8000-000000000004"
      ]
    });

    expect(txRepositories.historyEvents.insertMatchStakesImpacts).toHaveBeenCalledWith(
      "event-1",
      "group-1",
      openPeriod.id,
      [
        { playerId: "10000000-0000-4000-8000-000000000001", netDeltaVnd: 37500 },
        { playerId: "10000000-0000-4000-8000-000000000002", netDeltaVnd: -12500 },
        { playerId: "10000000-0000-4000-8000-000000000003", netDeltaVnd: -12500 },
        { playerId: "10000000-0000-4000-8000-000000000004", netDeltaVnd: -12500 }
      ]
    );
    expect(result.summary.totalOutstandingReceiveVnd).toBe(37500);
    expect(result.summary.totalOutstandingPayVnd).toBe(37500);
  });

  it("handles deterministic remainder allocation for 3 participants", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getCurrentOpenPeriod.mockResolvedValue(openPeriod);
    txRepositories.players.findActiveByIds.mockImplementation(async (_groupId: string, ids: string[]) =>
      ids.map((id) => ({ id, displayName: `Player-${id.slice(-4)}` }))
    );
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "Player-0001",
        totalMatches: 0,
        initNetVnd: 0,
        accruedNetVnd: 0,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(0);
    txRepositories.historyEvents.createEvent.mockImplementation(async (input: any) => ({
      id: "event-2",
      eventType: input.eventType,
      eventStatus: "ACTIVE",
      resetAt: null,
      resetReason: null,
      postedAt: input.postedAt,
      createdAt: "2026-01-01T00:00:00.000Z",
      note: input.note,
      amountVnd: input.amountVnd,
      playerId: input.playerId,
      secondaryPlayerId: input.secondaryPlayerId,
      debtPeriodId: input.debtPeriodId,
      ledgerBatchId: input.ledgerBatchId,
      balanceBeforeVnd: input.balanceBeforeVnd,
      balanceAfterVnd: input.balanceAfterVnd,
      outstandingBeforeVnd: input.outstandingBeforeVnd,
      outstandingAfterVnd: input.outstandingAfterVnd,
      metadataJson: input.metadataJson
    }));
    txRepositories.historyEvents.insertMatchStakesImpacts.mockResolvedValue(undefined);

    await service.createHistoryEvent({
      eventType: "MATCH_STAKES_ADVANCE",
      playerId: "10000000-0000-4000-8000-000000000001",
      amountVnd: 50000,
      impactMode: "AFFECTS_DEBT",
      participantPlayerIds: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000002",
        "10000000-0000-4000-8000-000000000003"
      ]
    });

    const insertedLines = txRepositories.historyEvents.insertMatchStakesImpacts.mock.calls[0]?.[3] ?? [];
    expect(insertedLines).toEqual([
      { playerId: "10000000-0000-4000-8000-000000000001", netDeltaVnd: 33333 },
      { playerId: "10000000-0000-4000-8000-000000000002", netDeltaVnd: -16667 },
      { playerId: "10000000-0000-4000-8000-000000000003", netDeltaVnd: -16666 }
    ]);
    expect(insertedLines.reduce((sum: number, line: { netDeltaVnd: number }) => sum + line.netDeltaVnd, 0)).toBe(0);
  });

  it("rejects advance when advancer is not in participantPlayerIds", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.matchStakesDebt.getCurrentOpenPeriod.mockResolvedValue(openPeriod);
    txRepositories.players.findActiveByIds.mockResolvedValue([
      { id: "10000000-0000-4000-8000-000000000001", displayName: "Player-0001" }
    ]);

    await expect(
      service.createHistoryEvent({
        eventType: "MATCH_STAKES_ADVANCE",
        playerId: "10000000-0000-4000-8000-000000000001",
        amountVnd: 50000,
        impactMode: "AFFECTS_DEBT",
        participantPlayerIds: [
          "10000000-0000-4000-8000-000000000002",
          "10000000-0000-4000-8000-000000000003"
        ]
      })
    ).rejects.toMatchObject({
      code: "MATCH_STAKES_ADVANCE_ADVANCER_NOT_IN_PARTICIPANTS"
    });
  });

  it("resets advance event and returns updated event status with rebuilt summary", async () => {
    const { service, txRepositories } = createFixture();
    txRepositories.historyEvents.getEventById.mockResolvedValue({
      id: "event-reset-1",
      groupId: "group-1",
      module: "MATCH_STAKES",
      eventType: "MATCH_STAKES_ADVANCE",
      eventStatus: "ACTIVE",
      resetAt: null,
      resetReason: null,
      postedAt: "2026-01-01T00:00:00.000Z",
      note: "advance",
      amountVnd: 50000,
      matchStakesImpactMode: "AFFECTS_DEBT",
      affectsDebt: true,
      playerId: "10000000-0000-4000-8000-000000000001",
      secondaryPlayerId: null,
      debtPeriodId: openPeriod.id,
      matchId: null,
      ledgerBatchId: null,
      balanceBeforeVnd: null,
      balanceAfterVnd: null,
      outstandingBeforeVnd: 0,
      outstandingAfterVnd: 37500,
      metadataJson: {
        participantPlayerIds: [
          "10000000-0000-4000-8000-000000000001",
          "10000000-0000-4000-8000-000000000002",
          "10000000-0000-4000-8000-000000000003",
          "10000000-0000-4000-8000-000000000004"
        ]
      },
      createdByRoleCode: "ADMIN",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    txRepositories.matchStakesDebt.getPeriodById.mockResolvedValue(openPeriod);
    txRepositories.historyEvents.markEventReset.mockResolvedValue({
      id: "event-reset-1",
      groupId: "group-1",
      module: "MATCH_STAKES",
      eventType: "MATCH_STAKES_ADVANCE",
      eventStatus: "RESET",
      resetAt: "2026-01-02T00:00:00.000Z",
      resetReason: "wrong record",
      postedAt: "2026-01-01T00:00:00.000Z",
      note: "advance",
      amountVnd: 50000,
      matchStakesImpactMode: "AFFECTS_DEBT",
      affectsDebt: true,
      playerId: "10000000-0000-4000-8000-000000000001",
      secondaryPlayerId: null,
      debtPeriodId: openPeriod.id,
      matchId: null,
      ledgerBatchId: null,
      balanceBeforeVnd: null,
      balanceAfterVnd: null,
      outstandingBeforeVnd: 0,
      outstandingAfterVnd: 37500,
      metadataJson: {
        participantPlayerIds: [
          "10000000-0000-4000-8000-000000000001",
          "10000000-0000-4000-8000-000000000002",
          "10000000-0000-4000-8000-000000000003",
          "10000000-0000-4000-8000-000000000004"
        ]
      },
      createdByRoleCode: "ADMIN",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z"
    });
    txRepositories.players.findActiveByIds.mockResolvedValue([
      { id: "10000000-0000-4000-8000-000000000001", displayName: "Player-0001" },
      { id: "10000000-0000-4000-8000-000000000002", displayName: "Player-0002" },
      { id: "10000000-0000-4000-8000-000000000003", displayName: "Player-0003" },
      { id: "10000000-0000-4000-8000-000000000004", displayName: "Player-0004" }
    ]);
    txRepositories.matchStakesDebt.listPeriodPlayerAggregates.mockResolvedValue([
      {
        playerId: "10000000-0000-4000-8000-000000000001",
        playerName: "Player-0001",
        totalMatches: 0,
        initNetVnd: 0,
        accruedNetVnd: 0,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      }
    ]);
    txRepositories.matchStakesDebt.countNonVoidedMatchesInPeriod.mockResolvedValue(0);

    const result = await service.resetHistoryEvent("event-reset-1", { reason: "wrong record", resetByRoleCode: "ADMIN" });

    expect(txRepositories.historyEvents.markEventReset).toHaveBeenCalledWith({
      groupId: "group-1",
      eventId: "event-reset-1",
      resetReason: "wrong record"
    });
    expect(result.event.eventStatus).toBe("RESET");
    expect(result.event.resetReason).toBe("wrong record");
    expect(result.summary.totalOutstandingReceiveVnd).toBe(0);
    expect(result.summary.totalOutstandingPayVnd).toBe(0);
  });
});


