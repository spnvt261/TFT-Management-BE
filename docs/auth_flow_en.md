# TFT History API - Authentication Flow (English)

This document explains the current internal JWT auth flow implemented in `apps/api`.

## 1. Scope and model

- Auth type: stateless JWT Bearer token.
- Roles:
  - `ADMIN`
  - `USER`
- Role source: `roles` table in PostgreSQL (`V9__add_roles_table.sql`).
- No account/password system.

## 2. Public vs protected routes

Public routes:

- `GET /`
- `GET /api/v1/health`
- `GET` / `HEAD` for all `/api/v1/**` endpoints
- `POST /api/v1/auth/login` (default USER login)
- `POST /api/v1/auth/check-access-code` (admin access-code login)

Protected routes:

- `POST` / `PUT` / `PATCH` / `DELETE` under `/api/v1/**`, except the two auth endpoints above.

## 3. Authorization policy

- `GET` / `HEAD`: public, no token required.
- `POST` / `PUT` / `PATCH` / `DELETE`: require valid bearer token with role `ADMIN`.
- `USER` token on write endpoint:
  - HTTP `403`
  - Error code `AUTH_FORBIDDEN`
- Missing/invalid/expired token on protected write endpoint:
  - HTTP `401`
  - Error code `AUTH_UNAUTHORIZED`

## 4. Login flows

### 4.1 Default USER login

Endpoint:

- `POST /api/v1/auth/login`

Behavior:

- Issues `USER` token.
- No admin code is required.

Response DTO:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "role": "USER"
  }
}
```

### 4.2 ADMIN login via access code

Endpoint:

- `POST /api/v1/auth/check-access-code`

Request DTO:

```json
{
  "accessCode": "admin123"
}
```

Behavior:

- Empty `accessCode` -> `400 AUTH_LOGIN_INVALID`
- Wrong `accessCode` -> `401 AUTH_ACCESS_CODE_INVALID`
- Correct `accessCode` -> issue `ADMIN` token

Success response DTO:

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

1. Client obtains token from either:
   - `/api/v1/auth/login` (USER)
   - `/api/v1/auth/check-access-code` (ADMIN)
2. For write calls, client sends:

```http
Authorization: Bearer <accessToken>
```

3. Backend verifies JWT signature + expiration.
4. Backend reads `roleCode` from verified payload.
5. Backend enforces admin-only policy for write methods.

## 7. Quick cURL examples

### 7.1 Login as USER

```bash
curl -X POST http://localhost:3000/api/v1/auth/login
```

### 7.2 Login as ADMIN with access code

```bash
curl -X POST http://localhost:3000/api/v1/auth/check-access-code \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"admin123"}'
```

### 7.3 Wrong admin access code

```bash
curl -X POST http://localhost:3000/api/v1/auth/check-access-code \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"wrong-code"}'
```

Expected: `401 AUTH_ACCESS_CODE_INVALID`.

### 7.4 Public GET without token

```bash
curl http://localhost:3000/api/v1/players?page=1&pageSize=20
```

Expected: success response.

### 7.5 USER token calls POST (forbidden)

```bash
curl -X POST http://localhost:3000/api/v1/players \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -d '{"displayName":"Test User","isActive":true}'
```

Expected: `403 AUTH_FORBIDDEN`.

### 7.6 Missing token on protected write API

```bash
curl -X POST http://localhost:3000/api/v1/players \
  -H "Content-Type: application/json" \
  -d '{"displayName":"No Token","isActive":true}'
```

Expected: `401 AUTH_UNAUTHORIZED`.

## 8. Swagger/OpenAPI notes

- Swagger UI: `GET /docs`
- Bearer scheme is configured as `BearerAuth`.
- `GET` / `HEAD` APIs are shown as public.
- Protected write APIs are documented with bearer requirement.
