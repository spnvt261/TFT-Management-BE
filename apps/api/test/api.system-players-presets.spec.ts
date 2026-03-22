import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";

describe("API - health, players, presets", () => {
  let app: Awaited<ReturnType<typeof createApp>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("returns health payload", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("tft-history-api");
  });

  it("supports player CRUD flow", async () => {
    app = await createApp(createMockServices());

    const listBefore = await app.inject({ method: "GET", url: "/api/v1/players?page=1&pageSize=20" });
    expect(listBefore.statusCode).toBe(200);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/players",
      payload: {
        displayName: "Eve",
        slug: "eve",
        isActive: true
      }
    });
    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json().data;
    expect(created.displayName).toBe("Eve");

    const detailResponse = await app.inject({ method: "GET", url: `/api/v1/players/${created.id}` });
    expect(detailResponse.statusCode).toBe(200);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/players/${created.id}`,
      payload: {
        displayName: "Eve Updated"
      }
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().data.displayName).toBe("Eve Updated");

    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/v1/players/${created.id}` });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().data.isActive).toBe(false);
  });

  it("supports preset get and put", async () => {
    app = await createApp(createMockServices());

    const before = await app.inject({
      method: "GET",
      url: "/api/v1/recent-match-presets/MATCH_STAKES"
    });

    expect(before.statusCode).toBe(200);

    const updated = await app.inject({
      method: "PUT",
      url: "/api/v1/recent-match-presets/MATCH_STAKES",
      payload: {
        lastRuleSetId: "20000000-0000-4000-8000-000000000001",
        lastRuleSetVersionId: "30000000-0000-4000-8000-000000000001",
        lastSelectedPlayerIds: [
          "10000000-0000-4000-8000-000000000001",
          "10000000-0000-4000-8000-000000000002",
          "10000000-0000-4000-8000-000000000003"
        ],
        lastParticipantCount: 3
      }
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.lastParticipantCount).toBe(3);
  });
});
