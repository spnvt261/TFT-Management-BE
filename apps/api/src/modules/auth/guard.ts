import type { FastifyRequest } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import type { AuthenticatedUser } from "./auth.types.js";
import type { JwtService } from "./jwt.service.js";

const PUBLIC_API_ROUTE_KEYS = new Set<string>(["GET /api/v1/health", "POST /api/v1/auth/login"]);

function normalizePath(path: string): string {
  if (path === "/") {
    return path;
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function parseRequestPath(url: string): string {
  const [pathOnly] = url.split("?", 1);
  return normalizePath(pathOnly ?? "/");
}

function isProtectedRoute(method: string, path: string): boolean {
  if (method === "OPTIONS") {
    return false;
  }

  if (!path.startsWith("/api/v1")) {
    return false;
  }

  return !PUBLIC_API_ROUTE_KEYS.has(`${method} ${path}`);
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseBearerToken(authorizationHeader: string | string[] | undefined): string {
  const normalizedHeader = getHeaderValue(authorizationHeader);

  if (!normalizedHeader) {
    throw new AppError(401, "AUTH_UNAUTHORIZED", "Missing Authorization header");
  }

  const [scheme, token] = normalizedHeader.split(" ", 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    throw new AppError(401, "AUTH_UNAUTHORIZED", "Invalid Authorization header format");
  }

  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new AppError(401, "AUTH_UNAUTHORIZED", "Invalid Authorization header format");
  }

  return normalizedToken;
}

export function authenticateRequest(
  authorizationHeader: string | string[] | undefined,
  jwtService: JwtService
): AuthenticatedUser {
  const token = parseBearerToken(authorizationHeader);

  try {
    const payload = jwtService.verifyAccessToken(token);
    return {
      roleId: payload.roleId,
      roleCode: payload.roleCode
    };
  } catch {
    throw new AppError(401, "AUTH_UNAUTHORIZED", "Invalid or expired access token");
  }
}

export function authorizeRequest(user: AuthenticatedUser, method: string): void {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return;
  }

  if (user.roleCode !== "ADMIN") {
    throw new AppError(403, "AUTH_FORBIDDEN", "Insufficient permission for this operation");
  }
}

export function createAuthPreHandler(jwtService: JwtService) {
  return async (request: FastifyRequest) => {
    const method = request.method.toUpperCase();
    const path = parseRequestPath(request.url);

    if (!isProtectedRoute(method, path)) {
      return;
    }

    const authenticatedUser = authenticateRequest(request.headers.authorization, jwtService);
    authorizeRequest(authenticatedUser, method);
    request.authUser = authenticatedUser;
  };
}
