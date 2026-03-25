import { createHmac, timingSafeEqual } from "node:crypto";
import type { JwtAccessPayload, RoleCode } from "./auth.types.js";

export interface JwtService {
  readonly expiresInSeconds: number;
  issueAccessToken(input: { roleId: string; roleCode: RoleCode }): string;
  verifyAccessToken(token: string): JwtAccessPayload;
}

interface JwtServiceOptions {
  secret: string;
  expiresIn: string;
}

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

function parseExpiresInToSeconds(input: string): number {
  const normalized = input.trim();
  const match = /^(\d+)([smhdSMHD]?)$/.exec(normalized);

  if (!match) {
    throw new Error(`Invalid JWT_EXPIRES_IN value: ${input}`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`JWT_EXPIRES_IN must be a positive integer: ${input}`);
  }

  const multiplierByUnit: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24
  };

  const multiplier = multiplierByUnit[unit];
  if (!multiplier) {
    throw new Error(`Unsupported JWT_EXPIRES_IN unit: ${input}`);
  }

  return amount * multiplier;
}

function toBase64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signHs256(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createJwtToken(payload: JwtAccessPayload, secret: string): string {
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = toBase64UrlJson(header);
  const encodedPayload = toBase64UrlJson(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signHs256(unsignedToken, secret);

  return `${unsignedToken}.${signature}`;
}

function validateJwtPayload(payload: unknown): payload is JwtAccessPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Partial<JwtAccessPayload>;
  const isRoleCode = candidate.roleCode === "ADMIN" || candidate.roleCode === "USER";

  return (
    typeof candidate.roleId === "string" &&
    candidate.roleId.length > 0 &&
    isRoleCode &&
    typeof candidate.iat === "number" &&
    Number.isFinite(candidate.iat) &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

export function createJwtService(options: JwtServiceOptions): JwtService {
  const expiresInSeconds = parseExpiresInToSeconds(options.expiresIn);
  const secret = options.secret;

  return {
    expiresInSeconds,
    issueAccessToken(input) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      return createJwtToken(
        {
          roleId: input.roleId,
          roleCode: input.roleCode,
          iat: nowInSeconds,
          exp: nowInSeconds + expiresInSeconds
        },
        secret
      );
    },
    verifyAccessToken(token) {
      const tokenParts = token.split(".");
      if (tokenParts.length !== 3) {
        throw new Error("Malformed token");
      }

      const [encodedHeader, encodedPayload, encodedSignature] = tokenParts;
      if (!encodedHeader || !encodedPayload || !encodedSignature) {
        throw new Error("Malformed token");
      }

      const header = parseBase64UrlJson<Partial<JwtHeader>>(encodedHeader);
      if (header.alg !== "HS256" || header.typ !== "JWT") {
        throw new Error("Unsupported token header");
      }

      const unsignedToken = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = signHs256(unsignedToken, secret);

      const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");
      const providedSignatureBuffer = Buffer.from(encodedSignature, "base64url");
      const hasValidSignature =
        expectedSignatureBuffer.length === providedSignatureBuffer.length &&
        timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer);

      if (!hasValidSignature) {
        throw new Error("Invalid token signature");
      }

      const payload = parseBase64UrlJson<unknown>(encodedPayload);
      if (!validateJwtPayload(payload)) {
        throw new Error("Invalid token payload");
      }

      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp <= nowInSeconds) {
        throw new Error("Token expired");
      }

      return payload;
    }
  };
}
