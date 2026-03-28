const API_V1_PREFIX = "/api/v1";

const PUBLIC_API_ROUTE_KEYS = new Set<string>([
  "POST /api/v1/auth/login",
  "POST /api/v1/auth/check-access-code"
]);

const WRITE_METHODS = new Set<string>(["POST", "PUT", "PATCH", "DELETE"]);

export function normalizePath(path: string): string {
  if (path === "/") {
    return path;
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function parseRequestPath(url: string): string {
  const [pathOnly] = url.split("?", 1);
  return normalizePath(pathOnly ?? "/");
}

export function isApiV1Route(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return normalizedPath === API_V1_PREFIX || normalizedPath.startsWith(`${API_V1_PREFIX}/`);
}

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

function isPublicApiRoute(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return true;
  }

  return PUBLIC_API_ROUTE_KEYS.has(routeKey(normalizedMethod, path));
}

export function requiresAuthentication(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizePath(path);

  if (normalizedMethod === "OPTIONS") {
    return false;
  }

  if (!isApiV1Route(normalizedPath)) {
    return false;
  }

  return !isPublicApiRoute(normalizedMethod, normalizedPath);
}

export function requiresAdminRole(method: string, path: string): boolean {
  return requiresAuthentication(method, path) && isWriteMethod(method);
}
