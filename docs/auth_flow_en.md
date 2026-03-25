# TFT History API - Authentication Flow (English)

This document explains the current internal JWT auth flow implemented in `apps/api`.

## 1. Scope and model

- Auth type: stateless JWT Bearer token.
- Roles:
  - `ADMIN`
  - `USER`
- Role source: `roles` table in PostgreSQL (`V9__add_roles_table.sql`).
- No account/password system. Access is decided by `accessCode` at login.

## 2. Public vs protected routes

Public routes:

- `GET /`
- `GET /api/v1/health`
- `POST /api/v1/auth/login`

Protected routes:

- All other `/api/v1/**` endpoints.

## 3. Authorization policy

- `USER`: only `GET` and `HEAD`.
- `ADMIN`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

If role is not allowed for method:

- HTTP `403`
- Error code: `AUTH_FORBIDDEN`

If token is missing/invalid/expired:

- HTTP `401`
- Error code: `AUTH_UNAUTHORIZED`

## 4. Login flow

Endpoint:

- `POST /api/v1/auth/login`

Request DTO:

```json
{
  "accessCode": "admin123"
}
```

Role resolution:

- `accessCode === "admin123"` -> role `ADMIN`
- any other non-empty string -> role `USER`
- empty string -> `400 AUTH_LOGIN_INVALID`

Response DTO:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "role": "ADMIN"
  }
}
```

## 5. JWT payload

Issued token includes at least:

- `roleId` (UUID from `roles` table)
- `roleCode` (`ADMIN` | `USER`)
- `iat` (issued-at, epoch seconds)
- `exp` (expiration, epoch seconds)

Config:

- `JWT_SECRET`
- `JWT_EXPIRES_IN` (default `24h`)

## 6. Request flow after login

1. Client calls `/api/v1/auth/login` and stores `accessToken`.
2. Client sends:

```http
Authorization: Bearer <accessToken>
```

3. Backend verifies JWT signature + expiration.
4. Backend reads `roleCode` from verified payload.
5. Backend applies method-based authorization rule.

## 7. Quick cURL examples

### 7.1 Login as ADMIN

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"admin123"}'
```

### 7.2 Login as USER

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"friends-only"}'
```

### 7.3 USER calls GET (allowed)

```bash
curl http://localhost:3000/api/v1/players?page=1&pageSize=20 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### 7.4 USER calls POST (forbidden)

```bash
curl -X POST http://localhost:3000/api/v1/players \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{"displayName":"Test User","isActive":true}'
```

Expected: `403 AUTH_FORBIDDEN`.

### 7.5 Missing token (unauthorized)

```bash
curl http://localhost:3000/api/v1/players?page=1&pageSize=20
```

Expected: `401 AUTH_UNAUTHORIZED`.

## 8. Swagger/OpenAPI notes

- Swagger UI: `GET /docs`
- Bearer scheme is configured in OpenAPI (`BearerAuth`).
- `POST /api/v1/auth/login` and `GET /api/v1/health` are marked as public (`security: []`).
- Other documented operations are protected by default.
