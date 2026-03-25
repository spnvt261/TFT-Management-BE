import type { FastifyInstance } from "fastify";

export async function loginAndGetToken(app: FastifyInstance, accessCode = "admin123"): Promise<string> {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
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

export async function loginAndGetAuthHeaders(
  app: FastifyInstance,
  accessCode = "admin123"
): Promise<Record<string, string>> {
  const accessToken = await loginAndGetToken(app, accessCode);
  return {
    authorization: `Bearer ${accessToken}`
  };
}
