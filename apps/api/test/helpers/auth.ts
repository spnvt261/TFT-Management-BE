import type { FastifyInstance } from "fastify";
import { env } from "../../src/core/config/env.js";

export async function loginAndGetToken(app: FastifyInstance, accessCode = env.auth.adminAccessCode): Promise<string> {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/check-access-code",
    payload: { accessCode }
  });

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Failed to login in tests. Status=${loginResponse.statusCode}`);
  }

  const body = loginResponse.json() as { success?: boolean; data?: { accessToken?: string } };
  const accessToken = body?.data?.accessToken;

  if (!accessToken) {
    throw new Error("Failed to read access token from login response in tests");
  }

  return accessToken;
}

export async function loginAsUserAndGetToken(app: FastifyInstance): Promise<string> {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login"
  });

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Failed to login as user in tests. Status=${loginResponse.statusCode}`);
  }

  const body = loginResponse.json() as { success?: boolean; data?: { accessToken?: string } };
  const accessToken = body?.data?.accessToken;

  if (!accessToken) {
    throw new Error("Failed to read user access token from login response in tests");
  }

  return accessToken;
}

export async function loginAndGetAuthHeaders(
  app: FastifyInstance,
  accessCode = env.auth.adminAccessCode
): Promise<Record<string, string>> {
  const accessToken = await loginAndGetToken(app, accessCode);
  return {
    authorization: `Bearer ${accessToken}`
  };
}
