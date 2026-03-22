import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";

describe("API - rules, matches, summaries", () => {
  let app: Awaited<ReturnType<typeof createApp>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("supports rule set and version endpoints", async () => {
    app = await createApp(createMockServices());

    const listResponse = await app.inject({ method: "GET", url: "/api/v1/rule-sets?page=1&pageSize=20" });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data.length).toBeGreaterThanOrEqual(2);

    const createRuleSetResponse = await app.inject({
      method: "POST",
      url: "/api/v1/rule-sets",
      payload: {
        module: "MATCH_STAKES",
        code: "CUSTOM_MS",
        name: "Custom MS",
        isDefault: false
      }
    });

    expect(createRuleSetResponse.statusCode).toBe(201);
    const ruleSetId = createRuleSetResponse.json().data.id;

    const createVersionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/rule-sets/${ruleSetId}/versions`,
      payload: {
        participantCountMin: 3,
        participantCountMax: 4,
        isActive: true,
        rules: [
          {
            code: "R1",
            name: "Rule 1",
            ruleKind: "BASE_RELATIVE_RANK",
            conditions: [
              {
                conditionKey: "participantCount",
                operator: "EQ",
                valueJson: 3
              }
            ],
            actions: [
              {
                actionType: "TRANSFER",
                amountVnd: 10000,
                sourceSelectorType: "PLAYER_BY_RELATIVE_RANK",
                sourceSelectorJson: { relativeRank: 2 },
                destinationSelectorType: "PLAYER_BY_RELATIVE_RANK",
                destinationSelectorJson: { relativeRank: 1 }
              }
            ]
          }
        ]
      }
    });

    expect(createVersionResponse.statusCode).toBe(201);
    const versionId = createVersionResponse.json().data.id;

    const detailVersionResponse = await app.inject({
      method: "GET",
      url: `/api/v1/rule-sets/${ruleSetId}/versions/${versionId}`
    });
    expect(detailVersionResponse.statusCode).toBe(200);

    const defaultResponse = await app.inject({
      method: "GET",
      url: "/api/v1/rule-sets/default/by-module/MATCH_STAKES"
    });
    expect(defaultResponse.statusCode).toBe(200);
  });

  it("validates match creation and supports create/detail/preset/summaries", async () => {
    app = await createApp(createMockServices());

    const duplicatePlayerPayload = {
      module: "MATCH_STAKES",
      playedAt: new Date().toISOString(),
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      participants: [
        { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
        { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 2 },
        { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
      ]
    };

    const duplicatePlayerResponse = await app.inject({
      method: "POST",
      url: "/api/v1/matches",
      payload: duplicatePlayerPayload
    });

    expect(duplicatePlayerResponse.statusCode).toBe(400);

    const duplicatePlacementResponse = await app.inject({
      method: "POST",
      url: "/api/v1/matches",
      payload: {
        ...duplicatePlayerPayload,
        participants: [
          { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
          { playerId: "10000000-0000-4000-8000-000000000002", tftPlacement: 1 },
          { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
        ]
      }
    });

    expect(duplicatePlacementResponse.statusCode).toBe(400);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/matches",
      payload: {
        module: "MATCH_STAKES",
        playedAt: new Date().toISOString(),
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        participants: [
          { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
          { playerId: "10000000-0000-4000-8000-000000000002", tftPlacement: 4 },
          { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
        ]
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const createdMatch = createResponse.json().data;

    const detailResponse = await app.inject({ method: "GET", url: `/api/v1/matches/${createdMatch.id}` });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().data.id).toBe(createdMatch.id);

    const presetResponse = await app.inject({
      method: "GET",
      url: "/api/v1/recent-match-presets/MATCH_STAKES"
    });

    expect(presetResponse.statusCode).toBe(200);
    expect(presetResponse.json().data.lastSelectedPlayerIds.length).toBe(3);

    const summaryResponse = await app.inject({ method: "GET", url: "/api/v1/match-stakes/summary" });
    expect(summaryResponse.statusCode).toBe(200);

    const ledgerResponse = await app.inject({ method: "GET", url: "/api/v1/match-stakes/ledger?page=1&pageSize=20" });
    expect(ledgerResponse.statusCode).toBe(200);

    const historyResponse = await app.inject({ method: "GET", url: "/api/v1/match-stakes/matches?page=1&pageSize=20" });
    expect(historyResponse.statusCode).toBe(200);

    const groupFundSummaryResponse = await app.inject({ method: "GET", url: "/api/v1/group-fund/summary" });
    expect(groupFundSummaryResponse.statusCode).toBe(200);

    const groupFundLedgerResponse = await app.inject({ method: "GET", url: "/api/v1/group-fund/ledger?page=1&pageSize=20" });
    expect(groupFundLedgerResponse.statusCode).toBe(200);

    const groupFundMatchesResponse = await app.inject({ method: "GET", url: "/api/v1/group-fund/matches?page=1&pageSize=20" });
    expect(groupFundMatchesResponse.statusCode).toBe(200);
  });
});
