import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";
import { loginAndGetAuthHeaders } from "./helpers/auth.js";

describe("API - rules, matches, summaries", () => {
  let app: Awaited<ReturnType<typeof createApp>> | null = null;
  let adminHeaders: Record<string, string> = {};

  async function injectAsAdmin(options: any): Promise<any> {
    if (!app) {
      throw new Error("App is not initialized");
    }

    return app.inject({
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...adminHeaders
      }
    });
  }

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    adminHeaders = {};
  });

  it("supports rule endpoints with internal immutable versioning", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const listResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/rule-sets?page=1&pageSize=20" });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data.length).toBeGreaterThanOrEqual(2);

    const createRuleResponse = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/rule-sets",
      payload: {
        module: "MATCH_STAKES",
        name: "Custom MS",
        description: "Initial builder description",
        status: "ACTIVE",
        isDefault: false,
        participantCountMin: 3,
        participantCountMax: 3,
        isActive: true,
        builderType: "MATCH_STAKES_PAYOUT",
        builderConfig: {
          participantCount: 3,
          winnerCount: 1,
          payouts: [{ relativeRank: 1, amountVnd: 100000 }],
          losses: [
            { relativeRank: 2, amountVnd: 50000 },
            { relativeRank: 3, amountVnd: 50000 }
          ],
          penalties: [{ absolutePlacement: 8, amountVnd: 10000 }]
        }
      }
    });

    expect(createRuleResponse.statusCode).toBe(201);
    const ruleSetId = createRuleResponse.json().data.id;
    const firstVersionId = createRuleResponse.json().data.latestVersion.id;
    expect(createRuleResponse.json().data.code).toMatch(/^[A-Z]{6}$/);
    expect(createRuleResponse.json().data.latestVersion.builderType).toBe("MATCH_STAKES_PAYOUT");
    expect(createRuleResponse.json().data.latestVersion.builderConfig.participantCount).toBe(3);

    const detailAfterCreateResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/rule-sets/${ruleSetId}`
    });
    expect(detailAfterCreateResponse.statusCode).toBe(200);
    expect(detailAfterCreateResponse.json().data.latestVersion.id).toBe(firstVersionId);
    expect(detailAfterCreateResponse.json().data.versions).toHaveLength(1);

    const editRuleResponse = await injectAsAdmin({
      method: "PATCH",
      url: `/api/v1/rule-sets/${ruleSetId}`,
      payload: {
        name: "Custom MS - Edited",
        description: "Raw version description",
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

    expect(editRuleResponse.statusCode).toBe(200);
    expect(editRuleResponse.json().data.latestVersion.id).not.toBe(firstVersionId);
    expect(editRuleResponse.json().data.latestVersion.versionNo).toBeGreaterThan(1);
    expect(editRuleResponse.json().data.latestVersion.rules[0].name).toBe("Rule 1");
    expect(editRuleResponse.json().data.latestVersion.rules[0].actions[0].amountVnd).toBe(10000);

    const latestVersionId = editRuleResponse.json().data.latestVersion.id;
    const previousVersion = editRuleResponse.json().data.versions.find((item: { id: string }) => item.id === firstVersionId);
    expect(previousVersion).toBeTruthy();
    expect(previousVersion.builderType).toBe("MATCH_STAKES_PAYOUT");
    expect(previousVersion.id).toBe(firstVersionId);
    expect(previousVersion.isActive).toBe(false);
    expect(previousVersion.effectiveTo).not.toBeNull();

    const editAgainResponse = await injectAsAdmin({
      method: "PATCH",
      url: `/api/v1/rule-sets/${ruleSetId}`,
      payload: {
        description: "Second raw version description",
        participantCountMin: 3,
        participantCountMax: 4,
        isActive: true,
        rules: [
          {
            code: "R1",
            name: "Rule 1 - Edited",
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
                amountVnd: 20000,
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
    expect(editAgainResponse.statusCode).toBe(200);
    expect(editAgainResponse.json().data.latestVersion.id).not.toBe(latestVersionId);
    expect(editAgainResponse.json().data.latestVersion.rules[0].name).toBe("Rule 1 - Edited");
    expect(editAgainResponse.json().data.latestVersion.rules[0].actions[0].amountVnd).toBe(20000);
    const lastVersionAfterSecondEdit = editAgainResponse
      .json()
      .data.versions.find((item: { id: string }) => item.id === latestVersionId);
    expect(lastVersionAfterSecondEdit.isActive).toBe(false);
    expect(lastVersionAfterSecondEdit.effectiveTo).not.toBeNull();

    const ruleSetDetailAfterEditResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/rule-sets/${ruleSetId}`
    });
    expect(ruleSetDetailAfterEditResponse.statusCode).toBe(200);
    expect(ruleSetDetailAfterEditResponse.json().data.latestVersion.id).toBe(editAgainResponse.json().data.latestVersion.id);
    expect(ruleSetDetailAfterEditResponse.json().data.versions.length).toBeGreaterThanOrEqual(3);

    const conflictModeResponse = await injectAsAdmin({
      method: "PATCH",
      url: `/api/v1/rule-sets/${ruleSetId}`,
      payload: {
        description: "Conflict version",
        participantCountMin: 3,
        participantCountMax: 3,
        builderType: "MATCH_STAKES_PAYOUT",
        builderConfig: {
          participantCount: 3,
          winnerCount: 1,
          payouts: [{ relativeRank: 1, amountVnd: 100000 }],
          losses: [
            { relativeRank: 2, amountVnd: 50000 },
            { relativeRank: 3, amountVnd: 50000 }
          ]
        },
        rules: [
          {
            code: "RAW_CONFLICT",
            name: "Raw Conflict",
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
    expect(conflictModeResponse.statusCode).toBe(400);

    const removedCreateVersionApiResponse = await injectAsAdmin({
      method: "POST",
      url: `/api/v1/rule-sets/${ruleSetId}/versions`,
      payload: {}
    });
    expect(removedCreateVersionApiResponse.statusCode).toBe(404);

    const removedGetVersionApiResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/rule-sets/${ruleSetId}/versions/${firstVersionId}`
    });
    expect(removedGetVersionApiResponse.statusCode).toBe(404);

    const defaultResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets/default/by-module/MATCH_STAKES"
    });
    expect(defaultResponse.statusCode).toBe(200);
    expect(defaultResponse.json().data.activeVersion).toBeNull();

    const defaultWithParticipantCountResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets/default/by-module/MATCH_STAKES?participantCount=4"
    });
    expect(defaultWithParticipantCountResponse.statusCode).toBe(200);
    expect(defaultWithParticipantCountResponse.json().data.activeVersion).not.toBeNull();

    const invalidParticipantCountResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets/default/by-module/MATCH_STAKES?participantCount=5"
    });
    expect(invalidParticipantCountResponse.statusCode).toBe(400);
  });

  it("supports rule list filters by status/default/modules/search/date", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const createInactiveMatchStakes = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/rule-sets",
      payload: {
        module: "MATCH_STAKES",
        name: "Alpha Filter Rule Set",
        status: "INACTIVE",
        isDefault: false,
        description: "Alpha filter description",
        participantCountMin: 3,
        participantCountMax: 3,
        isActive: true,
        builderType: "MATCH_STAKES_PAYOUT",
        builderConfig: {
          participantCount: 3,
          winnerCount: 1,
          payouts: [{ relativeRank: 1, amountVnd: 100000 }],
          losses: [
            { relativeRank: 2, amountVnd: 50000 },
            { relativeRank: 3, amountVnd: 50000 }
          ]
        }
      }
    });
    expect(createInactiveMatchStakes.statusCode).toBe(201);

    const createInactiveGroupFund = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/rule-sets",
      payload: {
        module: "GROUP_FUND",
        name: "Beta Filter Rule Set",
        status: "INACTIVE",
        isDefault: false,
        description: "Beta filter description",
        participantCountMin: 3,
        participantCountMax: 3,
        isActive: true,
        rules: [
          {
            code: "GF_RULE_1",
            name: "GF Rule 1",
            ruleKind: "FUND_CONTRIBUTION",
            conditions: [
              {
                conditionKey: "participantCount",
                operator: "EQ",
                valueJson: 3
              }
            ],
            actions: [
              {
                actionType: "POST_TO_FUND",
                amountVnd: 10000,
                sourceSelectorType: "SUBJECT_PLAYER",
                sourceSelectorJson: {},
                destinationSelectorType: "FUND_ACCOUNT",
                destinationSelectorJson: {}
              }
            ]
          }
        ]
      }
    });
    expect(createInactiveGroupFund.statusCode).toBe(201);

    const statusResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets?status=INACTIVE&page=1&pageSize=20"
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().data.length).toBeGreaterThanOrEqual(2);
    expect(statusResponse.json().data.every((item: { status: string }) => item.status === "INACTIVE")).toBe(true);

    const defaultAliasResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets?default=true&page=1&pageSize=20"
    });
    expect(defaultAliasResponse.statusCode).toBe(200);
    expect(defaultAliasResponse.json().data.length).toBeGreaterThan(0);
    expect(defaultAliasResponse.json().data.every((item: { isDefault: boolean }) => item.isDefault === true)).toBe(true);

    const modulesResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets?modules=GROUP_FUND&page=1&pageSize=20"
    });
    expect(modulesResponse.statusCode).toBe(200);
    expect(modulesResponse.json().data.length).toBeGreaterThan(0);
    expect(modulesResponse.json().data.every((item: { module: string }) => item.module === "GROUP_FUND")).toBe(true);

    const searchResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets?search=Alpha&page=1&pageSize=20"
    });
    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().data.length).toBeGreaterThan(0);
    expect(searchResponse.json().data.every((item: { name: string }) => item.name.toLowerCase().includes("alpha"))).toBe(true);

    const dateResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/rule-sets?from=2100-01-01T00:00:00.000Z&page=1&pageSize=20"
    });
    expect(dateResponse.statusCode).toBe(200);
    expect(dateResponse.json().data.length).toBe(0);
    expect(dateResponse.json().meta.total).toBe(0);
  });

  it("validates match creation and supports create/detail/preset/summaries", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const duplicatePlayerPayload = {
      module: "MATCH_STAKES",
      ruleSetId: "20000000-0000-4000-8000-000000000001",
      ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
      participants: [
        { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
        { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 2 },
        { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
      ]
    };

    const duplicatePlayerResponse = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/matches",
      payload: duplicatePlayerPayload
    });

    expect(duplicatePlayerResponse.statusCode).toBe(400);

    const duplicatePlacementResponse = await injectAsAdmin({
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

    const createResponse = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/matches",
      payload: {
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
        participants: [
          { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
          { playerId: "10000000-0000-4000-8000-000000000002", tftPlacement: 4 },
          { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
        ]
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const createdMatch = createResponse.json().data;

    const detailResponse = await injectAsAdmin({ method: "GET", url: `/api/v1/matches/${createdMatch.id}` });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().data.id).toBe(createdMatch.id);

    const presetResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/recent-match-presets/MATCH_STAKES"
    });

    expect(presetResponse.statusCode).toBe(200);
    expect(presetResponse.json().data.lastSelectedPlayerIds.length).toBe(3);

    const summaryResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/match-stakes/summary" });
    expect(summaryResponse.statusCode).toBe(200);

    const ledgerResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/match-stakes/ledger?page=1&pageSize=20" });
    expect(ledgerResponse.statusCode).toBe(200);

    const historyResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/match-stakes/matches?page=1&pageSize=20" });
    expect(historyResponse.statusCode).toBe(200);

    const groupFundSummaryResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/group-fund/summary" });
    expect(groupFundSummaryResponse.statusCode).toBe(200);

    const createManualGroupFundTransactionResponse = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/group-fund/transactions",
      payload: {
        transactionType: "CONTRIBUTION",
        playerId: "10000000-0000-4000-8000-000000000001",
        amountVnd: 25000,
        reason: "Manual contribution"
      }
    });
    expect(createManualGroupFundTransactionResponse.statusCode).toBe(201);

    const listManualGroupFundTransactionsResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/group-fund/transactions?page=1&pageSize=20"
    });
    expect(listManualGroupFundTransactionsResponse.statusCode).toBe(200);
    expect(listManualGroupFundTransactionsResponse.json().data.length).toBeGreaterThanOrEqual(1);

    const groupFundLedgerResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/group-fund/ledger?page=1&pageSize=20" });
    expect(groupFundLedgerResponse.statusCode).toBe(200);

    const groupFundMatchesResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/group-fund/matches?page=1&pageSize=20" });
    expect(groupFundMatchesResponse.statusCode).toBe(200);

    const dashboardResponse = await injectAsAdmin({ method: "GET", url: "/api/v1/dashboard/overview" });
    expect(dashboardResponse.statusCode).toBe(200);
  });

  it("supports debt-period-based match-stakes endpoints", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const createMatchResponse = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/matches",
      payload: {
        module: "MATCH_STAKES",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        ruleSetVersionId: "30000000-0000-4000-8000-000000000001",
        participants: [
          { playerId: "10000000-0000-4000-8000-000000000001", tftPlacement: 1 },
          { playerId: "10000000-0000-4000-8000-000000000002", tftPlacement: 4 },
          { playerId: "10000000-0000-4000-8000-000000000003", tftPlacement: 8 }
        ]
      }
    });
    expect(createMatchResponse.statusCode).toBe(201);
    const createdMatch = createMatchResponse.json().data;

    const currentPeriodResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/match-stakes/debt-periods/current"
    });
    expect(currentPeriodResponse.statusCode).toBe(200);
    const currentPeriod = currentPeriodResponse.json().data.period;

    const listPeriodsResponse = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/match-stakes/debt-periods?page=1&pageSize=20"
    });
    expect(listPeriodsResponse.statusCode).toBe(200);
    expect(listPeriodsResponse.json().data.length).toBeGreaterThanOrEqual(1);

    const detailResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/match-stakes/debt-periods/${currentPeriod.id}`
    });
    expect(detailResponse.statusCode).toBe(200);

    const timelineResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/match-stakes/debt-periods/${currentPeriod.id}/timeline`
    });
    expect(timelineResponse.statusCode).toBe(200);
    expect(timelineResponse.json().data.period.id).toBe(currentPeriod.id);
    expect(Array.isArray(timelineResponse.json().data.currentPlayers)).toBe(true);
    expect(timelineResponse.json().data.timeline.length).toBeGreaterThanOrEqual(2);
    expect(timelineResponse.json().data.timeline.at(-1).type).toBe("INITIAL");

    const timelineWithoutInitialResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/match-stakes/debt-periods/${currentPeriod.id}/timeline?includeInitialSnapshot=false`
    });
    expect(timelineWithoutInitialResponse.statusCode).toBe(200);
    expect(timelineWithoutInitialResponse.json().data.timeline.every((item: { type: string }) => item.type === "MATCH")).toBe(true);

    const createFirstSettlementResponse = await injectAsAdmin({
      method: "POST",
      url: `/api/v1/match-stakes/debt-periods/${currentPeriod.id}/settlements`,
      payload: {
        lines: [
          {
            payerPlayerId: "10000000-0000-4000-8000-000000000002",
            receiverPlayerId: "10000000-0000-4000-8000-000000000001",
            amountVnd: 50000
          }
        ]
      }
    });
    expect(createFirstSettlementResponse.statusCode).toBe(201);

    const closeResponse = await injectAsAdmin({
      method: "POST",
      url: `/api/v1/match-stakes/debt-periods/${currentPeriod.id}/close`,
      payload: {
        note: "carry remaining debt",
        closingBalances: [
          { playerId: "10000000-0000-4000-8000-000000000001", netVnd: 50000 },
          { playerId: "10000000-0000-4000-8000-000000000003", netVnd: -50000 }
        ]
      }
    });
    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().data.status).toBe("CLOSED");
    expect(closeResponse.json().data.nextPeriod.status).toBe("OPEN");

    const createNewPeriodResponse = await injectAsAdmin({
      method: "POST",
      url: "/api/v1/match-stakes/debt-periods",
      payload: { title: "New cycle" }
    });
    expect(createNewPeriodResponse.statusCode).toBe(409);

    const moduleMatchesResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/match-stakes/matches?page=1&pageSize=20&periodId=${currentPeriod.id}`
    });
    expect(moduleMatchesResponse.statusCode).toBe(200);
    expect(moduleMatchesResponse.json().data[0].debtPeriodId).toBe(currentPeriod.id);
    expect(moduleMatchesResponse.json().data[0].debtPeriodNo).toBe(1);
    expect(moduleMatchesResponse.json().data[0].periodMatchNo).toBe(1);

    const matchDetailResponse = await injectAsAdmin({
      method: "GET",
      url: `/api/v1/matches/${createdMatch.id}`
    });
    expect(matchDetailResponse.statusCode).toBe(200);
    expect(matchDetailResponse.json().data.debtPeriodId).toBe(currentPeriod.id);
    expect(matchDetailResponse.json().data.periodMatchNo).toBe(1);
  });
});


