import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";
import { loginAndGetToken, loginAsUserAndGetToken } from "./helpers/auth.js";
import { env } from "../src/core/config/env.js";

describe("API - auth and authorization", () => {
  let app: Awaited<ReturnType<typeof createApp>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("returns USER token for default login", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.role).toBe("USER");
    expect(typeof response.json().data.accessToken).toBe("string");
    expect(response.json().data.tokenType).toBe("Bearer");
  });

  it("returns explicit error for wrong admin access code", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/check-access-code",
      payload: { accessCode: "wrong-code" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("AUTH_ACCESS_CODE_INVALID");
  });

  it("returns AUTH_LOGIN_INVALID when admin access code is empty", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/check-access-code",
      payload: { accessCode: "   " }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("AUTH_LOGIN_INVALID");
  });

  it("returns ADMIN token for correct access code", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/check-access-code",
      payload: { accessCode: env.auth.adminAccessCode }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.role).toBe("ADMIN");
    expect(typeof response.json().data.accessToken).toBe("string");
  });

  it("allows USER on GET and blocks USER on write endpoints", async () => {
    app = await createApp(createMockServices());
    const userToken = await loginAsUserAndGetToken(app);

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/v1/players?page=1&pageSize=10",
      headers: {
        authorization: `Bearer ${userToken}`
      }
    });

    expect(getResponse.statusCode).toBe(200);

    const postResponse = await app.inject({
      method: "POST",
      url: "/api/v1/players",
      headers: {
        authorization: `Bearer ${userToken}`
      },
      payload: {
        displayName: "User Should Not Write",
        slug: "user-should-not-write",
        isActive: true
      }
    });

    expect(postResponse.statusCode).toBe(403);
    expect(postResponse.json().success).toBe(false);
    expect(postResponse.json().error.code).toBe("AUTH_FORBIDDEN");
  });

  it("allows ADMIN on write endpoints", async () => {
    app = await createApp(createMockServices());
    const adminToken = await loginAndGetToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/players",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        displayName: "Admin Writer",
        slug: "admin-writer",
        isActive: true
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().success).toBe(true);
    expect(response.json().data.displayName).toBe("Admin Writer");
  });

  it("allows GET endpoints without token", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/players?page=1&pageSize=10"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
  });

  it("returns 401 when write endpoint is called without token", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/players",
      payload: {
        displayName: "No Token",
        slug: "no-token",
        isActive: true
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("returns 401 when write endpoint is called with invalid token", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/players",
      headers: {
        authorization: "Bearer invalid-token"
      },
      payload: {
        displayName: "Invalid Token",
        slug: "invalid-token",
        isActive: true
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("documents GET routes as public and write routes as bearer-protected", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "GET",
      url: "/docs/json"
    });

    expect(response.statusCode).toBe(200);

    const openApi = response.json() as {
      paths?: Record<
        string,
        {
          get?: { security?: unknown };
          post?: { security?: unknown };
        }
      >;
    };

    expect(openApi.paths?.["/api/v1/players"]?.get?.security).toEqual([]);
    expect(openApi.paths?.["/api/v1/players"]?.post?.security).toEqual([{ BearerAuth: [] }]);
    expect(openApi.paths?.["/api/v1/auth/login"]?.post?.security).toEqual([]);
    expect(openApi.paths?.["/api/v1/auth/check-access-code"]?.post?.security).toEqual([]);
  });
});
