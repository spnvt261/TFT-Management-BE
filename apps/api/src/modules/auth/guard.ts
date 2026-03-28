import type { FastifyRequest } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import type { AuthenticatedUser } from "./auth.types.js";
import type { JwtService } from "./jwt.service.js";
import { parseRequestPath, requiresAdminRole, requiresAuthentication } from "./policy.js";

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

export function authorizeRequest(user: AuthenticatedUser, method: string, path: string): void {
  if (requiresAdminRole(method, path) && user.roleCode !== "ADMIN") {
    throw new AppError(403, "AUTH_FORBIDDEN", "Insufficient permission for this operation");
  }
}

export function createAuthPreHandler(jwtService: JwtService) {
  return async (request: FastifyRequest) => {
    const method = request.method.toUpperCase();
    const path = parseRequestPath(request.url);

    if (!requiresAuthentication(method, path)) {
      return;
    }

    const authenticatedUser = authenticateRequest(request.headers.authorization, jwtService);
    authorizeRequest(authenticatedUser, method, path);
    request.authUser = authenticatedUser;
  };
}
