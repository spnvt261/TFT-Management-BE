import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";
import { loginAndGetAuthHeaders } from "./helpers/auth.js";

describe("API - health, players, presets", () => {
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

  it("returns health payload", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("tft-history-api");
  });

  it("returns CORS header for cross-origin requests", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const response = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/players?page=1&pageSize=12&isActive=true",
      headers: {
        origin: "http://localhost:5173"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("supports player CRUD flow", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const listBefore = await injectAsAdmin({ method: "GET", url: "/api/v1/players?page=1&pageSize=20" });
    expect(listBefore.statusCode).toBe(200);

    const createResponse = await injectAsAdmin({
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

    const detailResponse = await injectAsAdmin({ method: "GET", url: `/api/v1/players/${created.id}` });
    expect(detailResponse.statusCode).toBe(200);

    const patchResponse = await injectAsAdmin({
      method: "PATCH",
      url: `/api/v1/players/${created.id}`,
      payload: {
        displayName: "Eve Updated"
      }
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().data.displayName).toBe("Eve Updated");

    const deleteResponse = await injectAsAdmin({ method: "DELETE", url: `/api/v1/players/${created.id}` });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json().data.isActive).toBe(false);
  });

  it("supports preset get and put", async () => {
    app = await createApp(createMockServices());
    adminHeaders = await loginAndGetAuthHeaders(app);

    const before = await injectAsAdmin({
      method: "GET",
      url: "/api/v1/recent-match-presets/MATCH_STAKES"
    });

    expect(before.statusCode).toBe(200);

    const updated = await injectAsAdmin({
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
