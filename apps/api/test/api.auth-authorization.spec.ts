import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMockServices } from "./helpers/mock-services.js";
import { loginAndGetToken } from "./helpers/auth.js";

describe("API - auth and authorization", () => {
  let app: Awaited<ReturnType<typeof createApp>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("returns ADMIN token for admin123 login", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { accessCode: "admin123" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.role).toBe("ADMIN");
    expect(typeof response.json().data.accessToken).toBe("string");
    expect(response.json().data.tokenType).toBe("Bearer");
  });

  it("returns USER token for non-empty non-admin accessCode", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { accessCode: "friends-code" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.role).toBe("USER");
    expect(typeof response.json().data.accessToken).toBe("string");
  });

  it("allows USER on GET and blocks USER on write endpoints", async () => {
    app = await createApp(createMockServices());
    const userToken = await loginAndGetToken(app, "friends-code");

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
    const adminToken = await loginAndGetToken(app, "admin123");

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

  it("returns 401 when protected endpoint is called without token", async () => {
    app = await createApp(createMockServices());

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/players?page=1&pageSize=10"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
    expect(response.json().error.code).toBe("AUTH_UNAUTHORIZED");
  });
});
