import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";
import { loginAndGetAuthHeaders } from "./helpers/auth.js";

const PLAYER_ID = "10000000-0000-4000-8000-000000000001";
const EVENT_ID = "121d25fd-51b5-4e97-bbd7-71525dada471";

async function buildAppWithHistoryEventSpy() {
  const services = createMockServices();
  await services.matchStakes.createDebtPeriod({ title: "P1", note: null });
  const current = await services.matchStakes.getCurrentDebtPeriod();

  const createHistoryEvent = vi.fn(async (input: any) => ({
    period: current.period,
    summary: current.summary,
    players: current.players,
    event: {
      id: EVENT_ID,
      module: "MATCH_STAKES" as const,
      itemType: input.eventType === "MATCH_STAKES_ADVANCE" ? "ADVANCE" : "NOTE",
      postedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      title: input.eventType === "MATCH_STAKES_ADVANCE" ? "Advance" : "Note",
      description: null,
      amountVnd: input.eventType === "MATCH_STAKES_ADVANCE" ? input.amountVnd ?? null : null,
      player: {
        id: PLAYER_ID,
        name: "An"
      },
      secondaryPlayer: null,
      matchId: null,
      debtPeriodId: current.period.id,
      ledgerBatchId: null,
      balanceBeforeVnd: 0,
      balanceAfterVnd: 50000,
      outstandingBeforeVnd: 0,
      outstandingAfterVnd: 50000,
      note: input.note ?? null,
      metadata: {}
    }
  }));

  services.matchStakes.createHistoryEvent = createHistoryEvent as unknown as typeof services.matchStakes.createHistoryEvent;

  const app = await createApp(services);
  const headers = await loginAndGetAuthHeaders(app);

  return {
    app,
    headers,
    periodId: current.period.id,
    createHistoryEvent
  };
}

describe("Match stakes history event route", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("accepts amountVnd number for MATCH_STAKES_ADVANCE", async () => {
    const setup = await buildAppWithHistoryEventSpy();
    app = setup.app;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/match-stakes/history-events",
      headers: setup.headers,
      payload: {
        eventType: "MATCH_STAKES_ADVANCE",
        playerId: PLAYER_ID,
        amountVnd: 50000,
        debtPeriodId: setup.periodId,
        impactMode: "AFFECTS_DEBT",
        note: "ok"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(setup.createHistoryEvent).toHaveBeenCalledTimes(1);
    expect(setup.createHistoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MATCH_STAKES_ADVANCE",
        playerId: PLAYER_ID,
        amountVnd: 50000,
        impactMode: "AFFECTS_DEBT",
        debtPeriodId: setup.periodId
      })
    );
  });

  it("maps INFORMATION_ONLY impact mode alias to INFORMATIONAL", async () => {
    const setup = await buildAppWithHistoryEventSpy();
    app = setup.app;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/match-stakes/history-events",
      headers: setup.headers,
      payload: {
        eventType: "MATCH_STAKES_ADVANCE",
        playerId: PLAYER_ID,
        amountVnd: 50000,
        debtPeriodId: setup.periodId,
        impactMode: "INFORMATION_ONLY",
        note: "ok"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(setup.createHistoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        impactMode: "INFORMATIONAL"
      })
    );
  });

  it("rejects invalid amount values", async () => {
    const setup = await buildAppWithHistoryEventSpy();
    app = setup.app;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/match-stakes/history-events",
      headers: setup.headers,
      payload: {
        eventType: "MATCH_STAKES_ADVANCE",
        playerId: PLAYER_ID,
        amountVnd: "abc",
        debtPeriodId: setup.periodId,
        impactMode: "AFFECTS_DEBT",
        note: "ok"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR"
      }
    });
    expect(setup.createHistoryEvent).not.toHaveBeenCalled();
  });
});
