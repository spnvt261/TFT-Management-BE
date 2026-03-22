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

describe("accounting safety - match void", () => {
  const txRepositories = {
    matches: {
      findById: vi.fn(),
      voidMatch: vi.fn()
    },
    ledgers: {
      getEntriesByMatch: vi.fn(),
      createBatch: vi.fn(),
      insertEntries: vi.fn()
    },
    audits: {
      insert: vi.fn()
    }
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    withTransactionMock.mockImplementation(async (_pool: unknown, callback: (tx: unknown) => Promise<unknown>) => {
      return callback({});
    });

    createRepositoriesMock.mockReturnValue(txRepositories);

    txRepositories.matches.findById.mockResolvedValue({
      id: "match-1",
      group_id: "group-1",
      module: "MATCH_STAKES",
      status: "POSTED"
    });
    txRepositories.ledgers.getEntriesByMatch.mockResolvedValue([
      {
        id: "entry-1",
        sourceAccountId: "acc-a",
        destinationAccountId: "acc-b",
        amountVnd: 10000,
        reasonText: "original transfer"
      }
    ]);
    txRepositories.ledgers.createBatch.mockResolvedValue({ id: "batch-reversal" });
    txRepositories.ledgers.insertEntries.mockResolvedValue(undefined);
    txRepositories.matches.voidMatch.mockResolvedValue(undefined);
    txRepositories.audits.insert.mockResolvedValue(undefined);
  });

  it("creates reversal entries and keeps historical ledger data", async () => {
    const service = new MatchService({} as any, {} as any, "group-1");

    const result = await service.voidMatch("match-1", "wrong input");

    expect(result.status).toBe("VOIDED");

    expect(txRepositories.ledgers.insertEntries).toHaveBeenCalledTimes(1);
    const insertArgs = txRepositories.ledgers.insertEntries.mock.calls[0];
    expect(insertArgs[0]).toBe("batch-reversal");

    const reversalEntries = insertArgs[2];
    expect(reversalEntries[0].sourceAccountId).toBe("acc-b");
    expect(reversalEntries[0].destinationAccountId).toBe("acc-a");
    expect(reversalEntries[0].amountVnd).toBe(10000);

    expect(txRepositories.matches.voidMatch).toHaveBeenCalledWith("match-1", "wrong input");

    expect(txRepositories.ledgers.getEntriesByMatch).toHaveBeenCalledWith("match-1");
    expect(txRepositories.audits.insert).toHaveBeenCalledTimes(1);
  });
});
