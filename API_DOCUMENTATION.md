# API Documentation - TFT2 Backend (Node.js/TypeScript)

## 1. Phạm vi và nguồn phân tích
- Tài liệu này được dựng **trực tiếp từ source code** trong `apps/api/src`, `apps/api/db/migrations` và kiểm tra route thực tế bằng `app.printRoutes()`.
- Không dùng suy diễn ngoài source.
- Thời điểm phân tích: `2026-03-28`.

## 2. Mục lục
- [1. Phạm vi và nguồn phân tích](#1-phạm-vi-và-nguồn-phân-tích)
- [2. Mục lục](#2-mục-lục)
- [3. Tổng quan hệ thống](#3-tổng-quan-hệ-thống)
- [4. Kiến trúc request flow](#4-kiến-trúc-request-flow)
- [5. Chuẩn chung toàn API](#5-chuẩn-chung-toàn-api)
- [6. Danh sách endpoint thực tế](#6-danh-sách-endpoint-thực-tế)
- [7. Chi tiết API theo module](#7-chi-tiết-api-theo-module)
- [8. Danh sách DTO/Schema/Model chính](#8-danh-sách-dtoschemamodel-chính)
- [9. Danh sách enum/constant/status quan trọng](#9-danh-sách-enumconstantstatus-quan-trọng)
- [10. Danh sách mã lỗi tổng hợp](#10-danh-sách-mã-lỗi-tổng-hợp)
- [11. Rule nghiệp vụ quan trọng toàn hệ thống](#11-rule-nghiệp-vụ-quan-trọng-toàn-hệ-thống)
- [12. Điểm chưa xác định chắc chắn từ source](#12-điểm-chưa-xác-định-chắc-chắn-từ-source)

## 3. Tổng quan hệ thống

### 3.1 Stack và thành phần chính
- Runtime: Node.js + TypeScript (ESM).
- Web framework: Fastify.
- Validation: Zod (`schema.parse(...)` ở handler).
- DB: PostgreSQL (`pg`).
- Migration: Flyway CLI, fallback sang built-in SQL runner nếu không có flyway command.
- API docs: `@fastify/swagger` + `@fastify/swagger-ui`.

### 3.2 Entrypoint và khởi tạo app
- File chạy server: `apps/api/src/main.ts`.
- Tạo app: `apps/api/src/app.ts`.
- Bootstrap DB + migration: `apps/api/src/bootstrap.ts`.
- Vercel handler: `apps/api/src/vercel.ts` và `api/index.ts`.

### 3.3 Đăng ký route thực tế
- Prefix API: `"/api/v1"` (đăng ký tại `app.register(..., { prefix: "/api/v1" })`).
- Route modules được đăng ký theo thứ tự:
  - System
  - Auth
  - Players
  - Rules
  - Matches
  - Presets
  - Match Stakes
  - Group Fund
  - Dashboard
- Ngoài `/api/v1` còn có:
  - `GET /`
  - `GET /docs`, `GET /docs/json`, `GET /docs/yaml`, static docs assets
  - `OPTIONS *`

## 4. Kiến trúc request flow

1. Request vào Fastify app.
2. CORS check (origin match theo `CORS_ALLOWED_ORIGINS`, hỗ trợ wildcard `*`).
3. `onRoute` hook gán OpenAPI `security` tự động theo policy auth.
4. `preHandler` global chạy auth guard:
   - Nếu route cần auth: parse bearer token, verify JWT, gán `request.authUser`.
   - Nếu write API (`POST/PUT/PATCH/DELETE`) thì bắt buộc role `ADMIN`.
5. Handler route parse input bằng Zod (`parse`), gọi service.
6. Service gọi repository; các flow ghi dữ liệu chính dùng transaction (`withTransaction`).
7. Response chuẩn:
   - Success: `{ success: true, data, meta? }`
   - Error: `{ success: false, error: { code, message, details? } }`
8. Error handler global map:
   - Fastify validation / ZodError -> `400 VALIDATION_ERROR`
   - `AppError` -> status/code/message theo throw
   - Lỗi khác -> `500 INTERNAL_ERROR`

## 5. Chuẩn chung toàn API

### 5.1 Authentication/Authorization policy
- Public:
  - `GET/HEAD` cho tất cả route `/api/v1/**`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/check-access-code`
- Protected:
  - Tất cả `POST/PUT/PATCH/DELETE` dưới `/api/v1/**` (trừ 2 auth route trên) yêu cầu JWT hợp lệ.
  - Write API yêu cầu role `ADMIN`, token `USER` bị `403 AUTH_FORBIDDEN`.

### 5.2 Header chuẩn
- `Authorization: Bearer <token>` cho API cần auth.
- `Content-Type: application/json` cho request có body.

### 5.2.1 JWT token
- Ký token: HMAC SHA-256 (`HS256`).
- Payload access token: `roleId`, `roleCode`, `iat`, `exp`.
- TTL token lấy từ env `JWT_EXPIRES_IN` (mặc định source: `24h`), parser hỗ trợ hậu tố `s|m|h|d`.

### 5.3 UUID và datetime
- UUID validate bằng regex dạng PostgreSQL UUID text.
- Datetime dùng ISO8601 (`z.string().datetime()`).

### 5.4 Pagination chuẩn
- Query thường có `page` và `pageSize`:
  - `page`: int dương, default `1`
  - `pageSize`: int dương, default `20`, max `100`
- Response meta:
  - `page`, `pageSize`, `total`, `totalPages`

### 5.5 Sort/filter/search chuẩn
- Sort/filter/search xử lý ở repository SQL:
  - Players: search theo `LOWER(display_name) LIKE`.
  - Rule sets: search `name ILIKE`, filter module/status/default/date.
  - Matches: filter module/status/player/ruleSet/period/date, sort `played_at DESC, created_at DESC`.
  - Ledger: filter module/player/date, sort `posted_at DESC, entry_order ASC`.

## 6. Danh sách endpoint thực tế

### 6.1 Hạ tầng (ngoài `/api/v1`)
- `GET /`
- `GET /docs`
- `GET /docs/json`
- `GET /docs/yaml`
- `GET /docs/static/index.html`
- `GET /docs/static/swagger-initializer.js`
- `GET /docs/*` (asset wildcard do swagger-ui plugin)
- `OPTIONS *`

### 6.2 API v1
- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/check-access-code`
- `GET /api/v1/players`
- `POST /api/v1/players`
- `GET /api/v1/players/:playerId`
- `PATCH /api/v1/players/:playerId`
- `DELETE /api/v1/players/:playerId`
- `GET /api/v1/rule-sets`
- `POST /api/v1/rule-sets`
- `GET /api/v1/rule-sets/:ruleSetId`
- `PATCH /api/v1/rule-sets/:ruleSetId`
- `GET /api/v1/rule-sets/default/by-module/:module`
- `GET /api/v1/recent-match-presets/:module`
- `PUT /api/v1/recent-match-presets/:module`
- `POST /api/v1/matches/preview`
- `POST /api/v1/matches`
- `GET /api/v1/matches`
- `GET /api/v1/matches/:matchId`
- `POST /api/v1/matches/:matchId/void`
- `GET /api/v1/match-stakes/debt-periods/current`
- `GET /api/v1/match-stakes/debt-periods`
- `GET /api/v1/match-stakes/debt-periods/:periodId/timeline`
- `GET /api/v1/match-stakes/debt-periods/:periodId`
- `POST /api/v1/match-stakes/debt-periods`
- `POST /api/v1/match-stakes/debt-periods/:periodId/settlements`
- `POST /api/v1/match-stakes/debt-periods/:periodId/close`
- `POST /api/v1/match-stakes/history-events`
- `GET /api/v1/match-stakes/history`
- `GET /api/v1/match-stakes/debt-periods/:periodId/history`
- `GET /api/v1/match-stakes/summary`
- `GET /api/v1/match-stakes/ledger`
- `GET /api/v1/match-stakes/matches`
- `POST /api/v1/group-fund/contributions`
- `POST /api/v1/group-fund/advances`
- `POST /api/v1/group-fund/history-events`
- `POST /api/v1/group-fund/transactions`
- `GET /api/v1/group-fund/transactions`
- `GET /api/v1/group-fund/history`
- `GET /api/v1/group-fund/summary`
- `GET /api/v1/group-fund/ledger`
- `GET /api/v1/group-fund/matches`
- `GET /api/v1/dashboard/overview`

## 7. Chi tiết API theo module

### 7.1 Hạ tầng và docs

## [Service Ready]
- Method: `GET`
- URL: `/`
- Module: Infra
- Chức năng: Kiểm tra service sẵn sàng.
- Authentication/Authorization: Không yêu cầu.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không có validate đặc biệt.
- Business logic: Trả payload cứng.
- Service flow: Fastify route trực tiếp tại `app.ts`.
- Response success:
  - `data.service`: `"tft-history-api"`
  - `data.status`: `"ready"`
- Error cases: Lỗi hệ thống chung `500`.
- Ghi chú: Route này không nằm trong `/api/v1`.

## [Swagger UI]
- Method: `GET`
- URL: `/docs`
- Module: Infra/Docs
- Chức năng: UI tài liệu OpenAPI.
- Authentication/Authorization: Không yêu cầu.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không.
- Business logic: Do `@fastify/swagger-ui` cung cấp.
- Service flow: Plugin route.
- Response success: HTML + static assets.
- Error cases: `500` nếu plugin lỗi.
- Ghi chú: Có thêm `/docs/json`, `/docs/yaml`, `/docs/static/*`.

## [OpenAPI JSON]
- Method: `GET`
- URL: `/docs/json`
- Module: Infra/Docs
- Chức năng: Trả OpenAPI JSON.
- Authentication/Authorization: Không yêu cầu.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không.
- Business logic: Sinh từ schema route + hook security.
- Service flow: Plugin swagger.
- Response success: JSON OpenAPI, gồm security per route.
- Error cases: `500` nếu sinh spec lỗi.
- Ghi chú: Được dùng trong test auth policy.

## [OpenAPI YAML]
- Method: `GET`
- URL: `/docs/yaml`
- Module: Infra/Docs
- Chức năng: Trả OpenAPI dạng YAML.
- Authentication/Authorization: Không yêu cầu.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không.
- Business logic: Từ swagger plugin.
- Service flow: Plugin swagger.
- Response success: YAML OpenAPI.
- Error cases: `500`.
- Ghi chú: Đường dẫn do plugin tạo.

## [Swagger Static Assets]
- Method: `GET`
- URL: `/docs/static/*`, `/docs/*`
- Module: Infra/Docs
- Chức năng: Phục vụ file tĩnh cho Swagger UI (`index.html`, `swagger-initializer.js`, JS/CSS assets).
- Authentication/Authorization: Không yêu cầu.
- Request:
  - Path variables: Không có
  - Query params: Không bắt buộc
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không.
- Business logic: Do plugin `@fastify/swagger-ui` cung cấp static handler.
- Service flow: Plugin route.
- Response success: Trả asset tĩnh tương ứng.
- Error cases: `404` (asset không tồn tại), `500` (plugin/runtime lỗi).
- Ghi chú:
  - `app.printRoutes()` xác nhận có các nhánh `/docs/static/index.html`, `/docs/static/swagger-initializer.js`, và wildcard `*`.

## [CORS Preflight]
- Method: `OPTIONS`
- URL: `*`
- Module: Infra/CORS
- Chức năng: Xử lý preflight toàn cục.
- Authentication/Authorization: Không yêu cầu.
- Request:
  - Path variables: N/A
  - Query params: N/A
  - Headers: `Origin`, `Access-Control-Request-Method`, `Access-Control-Request-Headers`
  - Body: Không
- Validate: Theo fastify-cors.
- Business logic: Trả header CORS.
- Service flow: Plugin CORS global.
- Response success: Status 204/200 tùy Fastify.
- Error cases: `CORS origin not allowed`.
- Ghi chú: Không thuộc `/api/v1`.

### 7.2 System

## [Health Check]
- Method: `GET`
- URL: `/api/v1/health`
- Module: System
- Chức năng: Kiểm tra trạng thái backend và timestamp server.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không có input.
- Business logic:
  - Trả `status: "ok"`, `service: "tft-history-api"`, `timestamp = nowIso()`.
- Service flow: Route trả trực tiếp.
- Response success:
  - `data.status` (`"ok"`)
  - `data.service` (`string`)
  - `data.timestamp` (`string datetime`)
- Error cases: `500 INTERNAL_ERROR`.
- Ghi chú:
  - Ví dụ:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "tft-history-api",
    "timestamp": "2026-03-28T10:00:00.000Z"
  }
}
```

### 7.3 Auth

## [Login User Mặc Định]
- Method: `POST`
- URL: `/api/v1/auth/login`
- Module: Auth
- Chức năng: Cấp token role `USER`.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Không yêu cầu body.
- Business logic:
  - Tìm role `USER` trong bảng `roles`.
  - Ký JWT HS256 với payload `{ roleId, roleCode, iat, exp }`.
- Service flow:
  - `AuthService.loginAsUser` -> `issueTokenForRole("USER")`.
- Response success:
  - `accessToken`, `tokenType = "Bearer"`, `expiresIn`, `role = "USER"`.
- Error cases:
  - `500 AUTH_ROLE_NOT_CONFIGURED` nếu thiếu role trong DB.
- Ghi chú:
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

## [Login Admin Bằng Access Code]
- Method: `POST`
- URL: `/api/v1/auth/check-access-code`
- Module: Auth
- Chức năng: Kiểm tra `accessCode`, đúng thì cấp token `ADMIN`.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: `Content-Type: application/json`
  - Body:
    - `accessCode` (`string`, bắt buộc)
- Validate:
  - Body theo Zod object `{ accessCode: string }`.
  - Trim rỗng -> lỗi nghiệp vụ.
- Business logic:
  - So sánh với `env.auth.adminAccessCode`.
  - Đúng -> issue token `ADMIN`.
- Service flow:
  - Route parse body -> `AuthService.loginAsAdmin(accessCode)`.
- Response success:
  - `accessToken`, `tokenType = "Bearer"`, `expiresIn`, `role = "ADMIN"`.
- Error cases:
  - `400 AUTH_LOGIN_INVALID` (`accessCode` rỗng sau trim)
  - `401 AUTH_ACCESS_CODE_INVALID` (sai mã)
  - `500 AUTH_ROLE_NOT_CONFIGURED`
- Ghi chú:
```json
{
  "accessCode": "admin123"
}
```

### 7.4 Players

## [Danh Sách Player]
- Method: `GET`
- URL: `/api/v1/players`
- Module: Players
- Chức năng: Lấy danh sách player theo group mặc định.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không có
  - Query params:
    - `isActive` (`boolean`, optional, coerce)
    - `search` (`string`, optional)
    - `page` (`int>0`, default `1`)
    - `pageSize` (`int>0`, max `100`, default `20`)
  - Headers: Không bắt buộc
  - Body: Không có
- Validate:
  - Zod query schema `listQuerySchema`.
- Business logic:
  - Filter active/search, phân trang.
  - Sort theo `p.created_at DESC`.
- Service flow:
  - `PlayerService.list` -> `PlayerRepository.list`.
- Response success:
  - `data`: mảng `PlayerResponse`
  - `meta`: pagination.
- Error cases:
  - `400 VALIDATION_ERROR` (query sai kiểu/range)
  - `500`
- Ghi chú:
```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```

## [Tạo Player]
- Method: `POST`
- URL: `/api/v1/players`
- Module: Players
- Chức năng: Tạo player mới và gắn vào `group_members`.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `displayName` (`string`, min1, max120, bắt buộc)
    - `slug` (`string|null`, max120, optional)
    - `avatarUrl` (`url|null`, optional)
    - `isActive` (`boolean`, optional, default `true`)
- Validate:
  - Zod `createSchema`.
- Business logic:
  - Insert `players`, rồi upsert `group_members`.
  - Bắt unique violation slug.
- Service flow:
  - `PlayerService.create` -> repo create -> map lỗi `23505`.
- Response success:
  - HTTP `201`, `data` là `PlayerResponse`.
- Error cases:
  - `400 VALIDATION_ERROR`
  - `401 AUTH_UNAUTHORIZED`
  - `403 AUTH_FORBIDDEN`
  - `409 PLAYER_DUPLICATE`
- Ghi chú:
```json
{
  "displayName": "Eve",
  "slug": "eve",
  "avatarUrl": null,
  "isActive": true
}
```

## [Chi Tiết Player]
- Method: `GET`
- URL: `/api/v1/players/:playerId`
- Module: Players
- Chức năng: Lấy chi tiết player theo ID.
- Authentication/Authorization: Public.
- Request:
  - Path variables:
    - `playerId` (`uuid`, bắt buộc)
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate:
  - Zod `uuidSchema`.
- Business logic:
  - Tìm player trong group hiện tại.
- Service flow:
  - `PlayerService.getById` -> repo findById.
- Response success:
  - `data`: `PlayerResponse`.
- Error cases:
  - `400 VALIDATION_ERROR`
  - `404 PLAYER_NOT_FOUND`
- Ghi chú: Không trả player ngoài group.

## [Cập Nhật Player]
- Method: `PATCH`
- URL: `/api/v1/players/:playerId`
- Module: Players
- Chức năng: Cập nhật một phần thông tin player.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables:
    - `playerId` (`uuid`)
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `displayName?`, `slug?`, `avatarUrl?`, `isActive?`
- Validate:
  - Body phải có ít nhất 1 field (`refine Object.keys > 0`).
- Business logic:
  - Cập nhật `group_members.is_active` nếu `isActive` có truyền.
  - Cập nhật table `players`.
  - Cho phép set `slug = null` hoặc `avatarUrl = null`.
- Service flow:
  - `PlayerService.update` -> repo update -> reload row.
- Response success:
  - `data`: `PlayerResponse`.
- Error cases:
  - `400 VALIDATION_ERROR`
  - `404 PLAYER_NOT_FOUND`
  - `401/403` auth.
- Ghi chú: Khi `isActive=false`, `left_at` được set nếu chưa có.

## [Xóa Mềm Player]
- Method: `DELETE`
- URL: `/api/v1/players/:playerId`
- Module: Players
- Chức năng: Soft-delete player trong group (`is_active = false`).
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables:
    - `playerId` (`uuid`)
  - Query params: Không có
  - Headers: `Authorization`
  - Body: Không có
- Validate: UUID param.
- Business logic:
  - Update `group_members.is_active=false`.
- Service flow:
  - `PlayerService.softDelete` -> repo `softDelete`.
- Response success:
  - `data.id`, `data.isActive=false`.
- Error cases:
  - `404 PLAYER_NOT_FOUND`
  - `401/403`
- Ghi chú: Không hard-delete bản ghi player.

### 7.5 Rules

## [Danh Sách Rule Sets]
- Method: `GET`
- URL: `/api/v1/rule-sets`
- Module: Rules
- Chức năng: List rule set theo filter.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không có
  - Query params:
    - `module` (`MATCH_STAKES|GROUP_FUND`, optional)
    - `modules` (mảng module hoặc CSV, optional)
    - `status` (`ACTIVE|INACTIVE`, optional)
    - `isDefault` (`boolean`, optional)
    - `default` (`boolean`, alias optional)
    - `search` (`string`, trim, max150, optional)
    - `from` / `to` (`datetime`, optional)
    - `page`, `pageSize`
  - Headers: Không bắt buộc
  - Body: Không có
- Validate:
  - Zod preprocess cho CSV `modules`, trim search.
- Business logic:
  - Filter theo DB.
  - `description` lấy từ latest version nếu có (`COALESCE`).
- Service flow:
  - `RuleService.listRuleSets` -> `RuleRepository.listRuleSets`.
- Response success:
  - `data`: `RuleSetResponse[]`
  - `meta`: pagination.
- Error cases:
  - `400 VALIDATION_ERROR`
- Ghi chú: `module` và `modules` có thể cùng truyền, service ưu tiên `modules`.

## [Tạo Rule Set + Version Đầu]
- Method: `POST`
- URL: `/api/v1/rule-sets`
- Module: Rules
- Chức năng: Tạo identity rule set và immutable version đầu tiên.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - Root:
      - `module`, `name`, `status?`, `isDefault?`
      - `description`
      - `participantCount` hoặc `participantCountMin` + `participantCountMax`
      - `effectiveTo?`, `isActive?`, `summaryJson?`
      - `builderType?`, `builderConfig?`, `rules?`
- Validate:
  - Bắt buộc có participant range.
  - `participantCountMin <= participantCountMax`.
  - Builder mode không được đi cùng raw rules.
- Business logic:
  - Backend tự generate code 6 ký tự A-Z.
  - Nếu `isDefault=true`, clear default cũ cùng module.
  - Tạo version mới, tự set `effectiveFrom = now`.
  - Builder `MATCH_STAKES_PAYOUT` sẽ validate config và compile rules.
- Service flow:
  - `RuleService.createRule` (transaction)
  - `createRuleSetWithGeneratedCode`
  - `RuleVersionCreationService.create`
- Response success:
  - HTTP `201`, `data`: `RuleSetDetailResponse`.
- Error cases:
  - `400 RULE_SET_VERSION_INVALID`
  - `400 RULE_BUILDER_INVALID_CONFIG`
  - `400 RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED`
  - `400 RULE_BUILDER_DUPLICATE_RANK`
  - `400 RULE_BUILDER_RANK_COVERAGE_INVALID`
  - `400 RULE_BUILDER_PAYOUT_LOSS_UNBALANCED`
  - `409 RULE_SET_DUPLICATE`
  - `409 RULE_SET_CODE_GENERATION_FAILED`
  - `401/403`
- Ghi chú: `code` không nhận từ client.

## [Chi Tiết Rule Set]
- Method: `GET`
- URL: `/api/v1/rule-sets/:ruleSetId`
- Module: Rules
- Chức năng: Lấy rule set + toàn bộ versions + latestVersion.
- Authentication/Authorization: Public.
- Request:
  - Path variables:
    - `ruleSetId` (`uuid`)
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: UUID param.
- Business logic:
  - Load metadata rule set.
  - Load version list desc và detail từng version (rules/conditions/actions).
- Service flow:
  - `RuleService.getRuleSet` -> `buildRuleSetDetail`.
- Response success:
  - `data`: `RuleSetDetailResponse`.
- Error cases:
  - `404 RULE_SET_NOT_FOUND`
- Ghi chú: `latestVersion` có thể `null` nếu chưa có version.

## [Sửa Rule Set (Tạo Version Mới)]
- Method: `PATCH`
- URL: `/api/v1/rule-sets/:ruleSetId`
- Module: Rules
- Chức năng: Update metadata rule set và/hoặc tạo immutable version mới.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables:
    - `ruleSetId` (`uuid`)
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - Metadata optional: `name`, `status`, `isDefault`
    - Không cho đổi `module`, `code`
    - Version patch fields: `description`, participant range, `effectiveTo`, `isActive`, `summaryJson`, builder fields, raw rules
- Validate:
  - Body là schema `.passthrough()`.
  - Nếu dùng `participantCount` cùng min/max thì phải khớp.
- Business logic:
  - Luôn tạo version mới từ latest version (snapshot immutable).
  - Nếu patch raw `rules` mà không có builder fields -> chế độ raw.
  - Nếu version cũ đang active thì bị deactivate + set `effective_to`.
- Service flow:
  - `RuleService.editRule` transaction.
  - `RuleVersionCreationService.createFromExistingVersion`.
- Response success:
  - `data`: `RuleSetDetailResponse` sau edit.
- Error cases:
  - `400 RULE_SET_MODULE_IMMUTABLE`
  - `400 RULE_SET_CODE_IMMUTABLE`
  - `400 RULE_BUILDER_INVALID_CONFIG`
  - `404 RULE_SET_NOT_FOUND`
  - `404 RULE_SET_VERSION_NOT_FOUND`
  - `401/403`
- Ghi chú: Đây là API thay cho API version riêng (`/versions`) đã không còn.

## [Default Rule Set Theo Module]
- Method: `GET`
- URL: `/api/v1/rule-sets/default/by-module/:module`
- Module: Rules
- Chức năng: Lấy default rule set của module, có thể resolve active version theo participantCount.
- Authentication/Authorization: Public.
- Request:
  - Path variables:
    - `module` (`MATCH_STAKES|GROUP_FUND`)
  - Query params:
    - `participantCount` (`3|4`, optional)
  - Headers: Không bắt buộc
  - Body: Không có
- Validate:
  - `participantCount` hiện tại chỉ cho phép `3|4`.
- Business logic:
  - Tìm default active rule set theo module.
  - Nếu không truyền `participantCount` -> `activeVersion = null`.
  - Nếu có -> resolve version theo participant range + effective window.
- Service flow:
  - `RuleService.getDefaultByModule`.
- Response success:
  - `data.ruleSet`
  - `data.activeVersion` (`null` hoặc object).
- Error cases:
  - `404 RULE_SET_DEFAULT_NOT_FOUND`
  - `400 VALIDATION_ERROR` (participantCount ngoài 3/4)
- Ghi chú: Với `GROUP_FUND`, query schema vẫn ràng buộc 3/4.

### 7.6 Presets

## [Lấy Recent Match Preset]
- Method: `GET`
- URL: `/api/v1/recent-match-presets/:module`
- Module: Presets
- Chức năng: Lấy preset gần nhất theo module.
- Authentication/Authorization: Public.
- Request:
  - Path variables:
    - `module` (`MATCH_STAKES|GROUP_FUND`)
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Module enum.
- Business logic:
  - Đọc từ `recent_match_presets`.
  - Nếu chưa có row -> trả default null/[].
- Service flow:
  - `PresetService.getByModule` -> repo `getByModule`.
- Response success:
  - `data`: `RecentPresetResponse`.
- Error cases:
  - `400 VALIDATION_ERROR`
- Ghi chú: `lastSelectedPlayerIds` luôn là mảng.

## [Upsert Recent Match Preset]
- Method: `PUT`
- URL: `/api/v1/recent-match-presets/:module`
- Module: Presets
- Chức năng: Ghi đè preset gần nhất theo module.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables:
    - `module` enum
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `lastRuleSetId` (`uuid|null`, optional)
    - `lastRuleSetVersionId` (`uuid|null`, optional)
    - `lastSelectedPlayerIds` (`uuid[]`, default `[]`)
    - `lastParticipantCount` (`int 3..4`, bắt buộc)
- Validate: Zod `upsertPresetSchema`.
- Business logic:
  - Insert/update theo unique `(group_id, module)`.
- Service flow:
  - `PresetService.upsert` -> repo upsert -> re-fetch.
- Response success:
  - `data`: `RecentPresetResponse`.
- Error cases:
  - `400 VALIDATION_ERROR`
  - `401/403`
- Ghi chú: API tạo/cập nhật idempotent theo module.

### 7.7 Matches

## [Preview Match Settlement]
- Method: `POST`
- URL: `/api/v1/matches/preview`
- Module: Matches
- Chức năng: Tính settlement preview, không persist DB.
- Authentication/Authorization: Yêu cầu JWT `ADMIN` (do là POST).
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `module`
    - `ruleSetId`
    - `note?`
    - `participants[]`:
      - `playerId`
      - `tftPlacement`
- Validate:
  - participants min 3 max 4.
  - validate duplicate player/placement và range placement 1..8 ở service.
- Business logic:
  - Validate player active + thuộc group.
  - Validate ruleSet tồn tại và module khớp.
  - Resolve applicable ruleSetVersion theo `playedAt=now`.
  - Chạy rule engine để tính lines/summary.
- Service flow:
  - `MatchService.previewMatch` -> `MatchCalculationService`.
- Response success:
  - `data`: `PreviewMatchResponse` gồm `settlementPreview`.
- Error cases:
  - `400 MATCH_PARTICIPANT_COUNT_INVALID`
  - `400 MATCH_DUPLICATE_PLAYER`
  - `400 MATCH_DUPLICATE_PLACEMENT`
  - `400 MATCH_PLACEMENT_INVALID`
  - `404 RULE_SET_NOT_FOUND`
  - `422 MATCH_PLAYERS_INVALID`
  - `422 MATCH_RULE_SET_MODULE_MISMATCH`
  - `422 RULE_SET_VERSION_NOT_APPLICABLE`
  - `400 RULE_SELECTOR_INVALID|RULE_SELECTOR_NOT_FOUND`
- Ghi chú:
  - `totalFundInVnd`/`totalFundOutVnd` được tính từ line có source/destination player null.

## [Tạo Match]
- Method: `POST`
- URL: `/api/v1/matches`
- Module: Matches
- Chức năng: Tạo match + settlement + ledger entries + audit + preset update.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không có
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `module`, `ruleSetId`, `ruleSetVersionId`
    - `note?`
    - `participants[]`
    - `confirmation?`:
      - `mode`: `ENGINE|MANUAL_ADJUSTED`
      - `participantNets?`: mảng `{ playerId, netVnd }`
      - `overrideReason?`
- Validate:
  - Zod body + validate nghiệp vụ ở service.
  - Với manual mode:
    - participantNets phải đủ và unique cho mọi participant.
    - `netVnd` phải integer.
    - module `MATCH_STAKES` bắt buộc tổng net = 0.
- Business logic:
  - Engine mode: dùng kết quả rule engine.
  - Manual mode: build settlement từ participant nets theo thuật toán deterministic.
  - `MATCH_STAKES`:
    - auto `getOrCreateOpenPeriod`.
    - reserve `periodMatchNo`.
  - Persist:
    - `matches` status `POSTED`
    - `match_participants`
    - `match_notes` (nếu có note)
    - `match_settlements` + lines
    - `ledger_entry_batches` + entries
    - `recent_match_presets`
    - `audit_logs`
- Service flow:
  - `MatchService.createMatch` transaction.
- Response success:
  - HTTP `201`, `data`: `MatchDetailResponse` (service trả từ `getMatchDetail`).
- Error cases:
  - Tất cả lỗi của preview
  - `400 MATCH_CONFIRMATION_INVALID`
  - `422 RULE_SET_VERSION_NOT_APPLICABLE`
- Ghi chú: Match tạo xong luôn có settlement và ledger batch `MATCH_SETTLEMENT`.

## [Danh Sách Match]
- Method: `GET`
- URL: `/api/v1/matches`
- Module: Matches
- Chức năng: List match đa module.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không có
  - Query params:
    - `module?`, `status?`, `playerId?`, `ruleSetId?`
    - `from?`, `to?`
    - `page`, `pageSize`
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: Zod `listMatchesQuerySchema`.
- Business logic:
  - Filter SQL theo query.
  - Với mỗi match: load participants, settlement, ruleSet, note.
  - `notePreview` cắt 120 ký tự đầu.
  - Derive `confirmationMode`, `manualAdjusted` từ settlement result snapshot.
- Service flow:
  - `MatchService.listMatches`.
- Response success:
  - `data`: `MatchListItemResponse[]`
  - `meta`: pagination.
- Error cases:
  - `400 VALIDATION_ERROR`
- Ghi chú: Sort mặc định mới nhất trước.

## [Chi Tiết Match]
- Method: `GET`
- URL: `/api/v1/matches/:matchId`
- Module: Matches
- Chức năng: Lấy full detail 1 match.
- Authentication/Authorization: Public.
- Request:
  - Path variables: `matchId` (`uuid`)
  - Query params: Không có
  - Headers: Không bắt buộc
  - Body: Không có
- Validate: UUID param.
- Business logic:
  - Load match + participants + note + settlement + ruleSet + ruleVersion.
  - Trả debt period fields nếu module `MATCH_STAKES`.
- Service flow:
  - `MatchService.getMatchDetail`.
- Response success:
  - `data`: `MatchDetailResponse`.
- Error cases:
  - `404 MATCH_NOT_FOUND`
  - `400 VALIDATION_ERROR`
- Ghi chú: `ruleSetVersion` có thể `null` nếu không load được version.

## [Void Match]
- Method: `POST`
- URL: `/api/v1/matches/:matchId/void`
- Module: Matches
- Chức năng: Void match và tạo bút toán đảo.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: `matchId` (`uuid`)
  - Query params: Không có
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `reason` (`string`, min3, max500)
- Validate:
  - Zod body + service trim check.
- Business logic:
  - Không cho void lại match đã `VOIDED`.
  - Lấy toàn bộ ledger entries của match, tạo batch `MATCH_VOID_REVERSAL`, đảo source/destination.
  - Update match status VOIDED + reason + voidedAt.
  - Ghi audit.
- Service flow:
  - `MatchService.voidMatch` transaction.
- Response success:
  - `data.id`, `status="VOIDED"`, `reason`, `voidedAt`.
- Error cases:
  - `400 MATCH_VOID_REASON_INVALID`
  - `404 MATCH_NOT_FOUND`
  - `422 MATCH_ALREADY_VOIDED`
  - `401/403`
- Ghi chú: Không xóa dữ liệu gốc, chỉ thêm reversal ledger.

### 7.8 Match Stakes

## [Debt Period Hiện Tại]
- Method: `GET`
- URL: `/api/v1/match-stakes/debt-periods/current`
- Module: Match Stakes
- Chức năng: Lấy kỳ nợ OPEN hiện tại + summary + players.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params: Không
  - Headers: Không bắt buộc
  - Body: Không
- Validate: Không input.
- Business logic:
  - Chỉ lấy period status OPEN.
- Service flow:
  - `MatchStakesService.getCurrentDebtPeriod`.
- Response success:
  - `data.period`, `data.summary`, `data.players`.
- Error cases:
  - `404 DEBT_PERIOD_NOT_FOUND`

## [Danh Sách Debt Period]
- Method: `GET`
- URL: `/api/v1/match-stakes/debt-periods`
- Module: Match Stakes
- Chức năng: List debt periods có pagination.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params: `page`, `pageSize`
  - Headers: Không bắt buộc
  - Body: Không
- Validate: page/pageSize.
- Business logic:
  - Mỗi period được enrich summary aggregate.
- Service flow:
  - `MatchStakesService.listDebtPeriods`.
- Response success:
  - `data`: `DebtPeriodListItem[]`
  - `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Timeline Debt Period]
- Method: `GET`
- URL: `/api/v1/match-stakes/debt-periods/:periodId/timeline`
- Module: Match Stakes
- Chức năng: Lịch sử tích lũy nợ theo thời gian trong period, gồm cả match và non-match history event.
- Authentication/Authorization: Public.
- Request:
  - Path variables: `periodId` (`uuid`)
  - Query params:
    - `includeInitialSnapshot` (`boolean`, default `true`, nhận `true/false/1/0`)
  - Headers: Không bắt buộc
  - Body: Không
- Validate:
  - UUID + boolean preprocess.
- Business logic:
  - Chỉ dùng match không VOIDED.
  - Merge hai nguồn theo thứ tự thời gian thực (match + `module_history_events` của debt period):
    - `MATCH`
    - `ADVANCE`
    - `NOTE`
  - Build rows cho toàn bộ player scope mỗi item, có `cumulativeNetVnd`.
  - Với event có `affectsDebt=true`, delta lấy từ `match_stakes_history_event_player_impacts`.
  - Timeline trả theo thứ tự mới -> cũ, snapshot `INITIAL` đặt cuối khi bật option.
- Service flow:
  - `MatchStakesService.getDebtPeriodTimeline`.
- Response success:
  - `data.period`, `summary`, `currentPlayers`, `timeline[]`.
  - `timeline[].type`: `MATCH|INITIAL|ADVANCE|NOTE`
  - `timeline[]` có thêm field cho event:
    - `eventId`, `eventType`, `amountVnd`, `note`, `affectsDebt`, `impactMode`, `metadata`
- Error cases:
  - `404 DEBT_PERIOD_NOT_FOUND`
  - `400 VALIDATION_ERROR`

## [Chi Tiết Debt Period]
- Method: `GET`
- URL: `/api/v1/match-stakes/debt-periods/:periodId`
- Module: Match Stakes
- Chức năng: Detail period gồm summary, players, settlements, recent matches.
- Authentication/Authorization: Public.
- Request:
  - Path variables: `periodId` uuid
  - Query params: Không
  - Headers: Không
  - Body: Không
- Validate: UUID.
- Business logic:
  - recentMatches giới hạn `20`.
  - settlements lấy từ bảng debt settlement.
- Service flow:
  - `MatchStakesService.getDebtPeriodDetail`.
- Response success:
  - `data`: `DebtPeriodDetailResponse`.
- Error cases:
  - `404 DEBT_PERIOD_NOT_FOUND`

## [Tạo Debt Period]
- Method: `POST`
- URL: `/api/v1/match-stakes/debt-periods`
- Module: Match Stakes
- Chức năng: Tạo kỳ nợ OPEN mới.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không
  - Query params: Không
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `title?` (`string|max150|null`)
    - `note?` (`string|max4000|null`)
- Validate: Zod body.
- Business logic:
  - Chỉ cho 1 OPEN period/group (unique partial index).
- Service flow:
  - `MatchStakesService.createDebtPeriod` transaction.
- Response success:
  - HTTP `201`, `data`: `DebtPeriod`.
- Error cases:
  - `409 DEBT_PERIOD_OPEN_ALREADY_EXISTS`
  - `401/403`

## [Tạo Debt Settlement]
- Method: `POST`
- URL: `/api/v1/match-stakes/debt-periods/:periodId/settlements`
- Module: Match Stakes
- Chức năng: Ghi nhận thanh toán thực tế giữa người chơi trong kỳ.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: `periodId` uuid
  - Query params: Không
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `postedAt?` datetime
    - `note?` string|max4000|null
    - `lines[]` (min1):
      - `payerPlayerId` uuid
      - `receiverPlayerId` uuid
      - `amountVnd` int>0
      - `note?` string|max1000|null
- Validate:
  - payer != receiver.
  - line amount integer dương.
- Business logic:
  - Period phải tồn tại và OPEN.
  - Tất cả player phải active member.
  - Không cho overpay:
    - không được làm zero-outstanding thành non-zero
    - không được đổi dấu outstanding nếu chưa về 0
    - không được tăng độ lớn outstanding sai chiều
  - Ghi settlement + lines + audit.
- Service flow:
  - `MatchStakesService.createDebtSettlement` transaction.
- Response success:
  - HTTP `201`, `data.settlement`, `data.summary`, `data.players`.
- Error cases:
  - `400 DEBT_SETTLEMENT_INVALID`
  - `404 DEBT_PERIOD_NOT_FOUND`
  - `422 DEBT_PERIOD_NOT_OPEN`
  - `422 DEBT_SETTLEMENT_INVALID` (player không active)
  - `422 DEBT_SETTLEMENT_OVERPAY`
  - `401/403`

## [Đóng Debt Period]
- Method: `POST`
- URL: `/api/v1/match-stakes/debt-periods/:periodId/close`
- Module: Match Stakes
- Chức năng: Đóng kỳ nợ OPEN, tạo kỳ mới và carry-forward số dư.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: `periodId` uuid
  - Query params: Không
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `note?` string|max4000|null
    - `closingBalances[]`:
      - `playerId` uuid (không trùng)
      - `netVnd` int
- Validate:
  - Không duplicate playerId.
  - playerId phải thuộc current period scope.
- Business logic:
  - Period phải OPEN.
  - Normalize danh sách về toàn bộ player scope (player không gửi => net=0).
  - Tổng net normalized phải bằng 0.
  - Close period hiện tại, tạo period mới OPEN.
  - Ghi init balances sang period mới (bỏ qua giá trị 0).
  - Set link `nextPeriodId`.
  - Ghi audit close.
- Service flow:
  - `MatchStakesService.closeDebtPeriod` transaction.
- Response success:
  - `data.id`, `status="CLOSED"`, `closedAt`, `nextPeriod`, `carryForwardBalances`.
- Error cases:
  - `400 DEBT_PERIOD_CLOSING_BALANCE_INVALID`
  - `404 DEBT_PERIOD_NOT_FOUND`
  - `422 DEBT_PERIOD_NOT_OPEN`
  - `422 DEBT_PERIOD_CLOSING_BALANCE_INVALID` (total != 0)
  - `401/403`

## [Tạo Match-Stakes History Event]
- Method: `POST`
- URL: `/api/v1/match-stakes/history-events`
- Module: Match Stakes
- Chức năng: Tạo non-match history event cho match-stakes timeline/history.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không
  - Query params: Không
  - Headers: `Authorization`, `Content-Type`
  - Body (discriminated union theo `eventType`):
    - `MATCH_STAKES_ADVANCE`
      - `eventType`: `"MATCH_STAKES_ADVANCE"`
      - `postedAt?`: datetime
      - `playerId`: uuid
      - `amountVnd`: int>0
      - `note?`: string|max4000|null
      - `impactMode?`: `"INFORMATIONAL"|"AFFECTS_DEBT"` (default `"AFFECTS_DEBT"`)
      - `beneficiaryPlayerIds?`: `uuid[]` min1, không duplicate
      - `debtPeriodId?`: uuid (nếu không truyền sẽ dùng current OPEN period)
    - `MATCH_STAKES_NOTE`
      - `eventType`: `"MATCH_STAKES_NOTE"`
      - `postedAt?`: datetime
      - `note`: string min1 max4000
      - `playerId?`: uuid
      - `debtPeriodId?`: uuid
- Validate:
  - body theo Zod discriminated union.
  - `beneficiaryPlayerIds` không duplicate.
- Business logic:
  - Debt period phải tồn tại và đang `OPEN`.
  - Với `MATCH_STAKES_NOTE`: `note` bắt buộc, `playerId` (nếu có) phải là active member.
  - Với `MATCH_STAKES_ADVANCE`:
    - `playerId` phải là active member.
    - `amountVnd` phải > 0.
    - `INFORMATIONAL`: chỉ ghi event hiển thị, `affectsDebt=false`.
    - `AFFECTS_DEBT`: ghi event + impact lines theo player; outstanding summary thay đổi ngay.
    - `beneficiaryPlayerIds`:
      - nếu không truyền: mặc định toàn bộ active player trừ người advance.
      - không được chứa chính `playerId`.
      - tất cả phải là active member.
  - Ghi audit `MATCH_STAKES_HISTORY_EVENT`.
- Service flow:
  - `MatchStakesService.createHistoryEvent` transaction.
- Response success:
  - HTTP `201`
  - `data.period`, `data.event`, `data.summary`, `data.players`
  - `data.event` theo unified history item contract (`module="MATCH_STAKES"`).
- Error cases:
  - `400 MATCH_STAKES_HISTORY_EVENT_INVALID`
  - `400 MATCH_STAKES_ADVANCE_INVALID`
  - `404 DEBT_PERIOD_NOT_FOUND`
  - `422 DEBT_PERIOD_NOT_OPEN`
  - `422 MATCH_STAKES_HISTORY_EVENT_INVALID`
  - `422 MATCH_STAKES_ADVANCE_INVALID`
  - `401/403`

## [Unified Match-Stakes History]
- Method: `GET`
- URL: `/api/v1/match-stakes/history`
- Module: Match Stakes
- Chức năng: Feed hợp nhất cho FE gồm match + debt settlement + non-match history event.
- Authentication/Authorization: Public.
- Request:
  - Query params:
    - `playerId?`, `periodId?`, `from?`, `to?`
    - `itemTypes?`: `MATCH|DEBT_SETTLEMENT|ADVANCE|NOTE`
      - hỗ trợ dạng CSV (`itemTypes=MATCH,ADVANCE`) hoặc multi query key
    - `page`, `pageSize`
- Validate: UUID/date/pagination + preprocess `itemTypes`.
- Business logic:
  - Hợp nhất 3 nguồn:
    - `matches` (module `MATCH_STAKES`)
    - `match_stakes_debt_settlements`
    - `module_history_events` (module `MATCH_STAKES`)
  - Filter `playerId` cho event có xét thêm bảng impact (`match_stakes_history_event_player_impacts`).
  - Sort ổn định: `postedAt DESC`, `createdAt DESC`, `id DESC`.
- Service flow:
  - `MatchStakesService.getHistory` -> `HistoryEventRepository.listMatchStakesHistory`.
- Response success:
  - `data`: `MatchStakesUnifiedHistoryItem[]`
  - `meta`: pagination.
  - `itemType` discriminator:
    - `MATCH`
    - `DEBT_SETTLEMENT`
    - `ADVANCE`
    - `NOTE`
- Error cases:
  - `400 VALIDATION_ERROR`

## [Unified History Theo Debt Period]
- Method: `GET`
- URL: `/api/v1/match-stakes/debt-periods/:periodId/history`
- Module: Match Stakes
- Chức năng: Như endpoint unified history, nhưng fix theo một debt period cụ thể.
- Authentication/Authorization: Public.
- Request:
  - Path variables: `periodId` uuid
  - Query params:
    - `playerId?`, `from?`, `to?`, `itemTypes?`, `page`, `pageSize`
- Validate: UUID/date/pagination.
- Business logic:
  - Route map `periodId` vào filter của unified history.
- Service flow:
  - `MatchStakesService.getHistory`.
- Response success:
  - `data`: `MatchStakesUnifiedHistoryItem[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Match Stakes Summary]
- Method: `GET`
- URL: `/api/v1/match-stakes/summary`
- Module: Match Stakes
- Chức năng: Tổng hợp thống kê match stakes.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params:
    - `from?`, `to?` datetime
  - Headers: Không
  - Body: Không
- Validate: datetime query optional.
- Business logic:
  - Lấy player summary từ ledger repo.
  - Đếm totalMatches từ matches repo theo module/date.
  - `debtSuggestions` hiện trả mảng rỗng.
- Service flow:
  - `MatchStakesService.getSummary`.
- Response success:
  - `data.module="MATCH_STAKES"`, `players[]`, `debtSuggestions[]`, `totalMatches`, `range`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Match Stakes Ledger]
- Method: `GET`
- URL: `/api/v1/match-stakes/ledger`
- Module: Match Stakes
- Chức năng: Liệt kê ledger entries module MATCH_STAKES.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params:
    - `playerId?`, `from?`, `to?`, `page`, `pageSize`
  - Headers: Không
  - Body: Không
- Validate: UUID/date/pagination.
- Business logic:
  - Filter theo module + player/date.
  - Map snake_case DB row sang response camelCase.
- Service flow:
  - `MatchStakesService.getLedger` -> `LedgerRepository.listLedgerByModule`.
- Response success:
  - `data`: `ModuleLedgerItem[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Match Stakes Match History]
- Method: `GET`
- URL: `/api/v1/match-stakes/matches`
- Module: Match Stakes
- Chức năng: Lịch sử match module MATCH_STAKES.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params:
    - `playerId?`, `ruleSetId?`, `periodId?`, `from?`, `to?`, `page`, `pageSize`
  - Headers: Không
  - Body: Không
- Validate: UUID/date/pagination.
- Business logic:
  - Reuse `services.matches.listMatches` với `module="MATCH_STAKES"`.
- Service flow:
  - Route -> `MatchService.listMatches`.
- Response success:
  - `data`: `ModuleMatchHistoryItem[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

### 7.9 Group Fund

## [Mark Player Paid Into Group Fund]
- Method: `POST`
- URL: `/api/v1/group-fund/contributions`
- Module: Group Fund
- Chức năng: Đánh dấu player đã nộp quỹ (wrapper lên manual transaction `WITHDRAWAL`).
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không
  - Query params: Không
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `playerId` uuid
    - `amountVnd` int>0
    - `note?` string|max500|null
    - `postedAt?` datetime
- Validate: Zod body.
- Business logic:
  - Chuẩn hóa note -> reason mặc định nếu rỗng.
  - Gọi `createManualTransaction` với `transactionType="WITHDRAWAL"`.
  - Tạo history event `GROUP_FUND_CONTRIBUTION` gắn `ledgerBatchId` để vào unified history.
- Service flow:
  - `GroupFundService.markContributionPaid`.
- Response success:
  - HTTP `201`, `batchId`, `postedAt`, `playerId`, `playerName`, `amountVnd`, `note`.
- Error cases:
  - `422 GROUP_FUND_PLAYER_INVALID`
  - `400 VALIDATION_ERROR`
  - `401/403`

## [Record Group-Fund Advance]
- Method: `POST`
- URL: `/api/v1/group-fund/advances`
- Module: Group Fund
- Chức năng: Ghi nhận player ứng tiền cá nhân vào quỹ nhóm.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Body:
    - `playerId`: uuid
    - `amountVnd`: int>0
    - `note?`: string|max2000|null
    - `postedAt?`: datetime
- Validate: Zod body.
- Business logic:
  - `playerId` phải là active member.
  - Tạo ledger batch `MANUAL_ADJUSTMENT`, direction `PLAYER_FUND_OBLIGATION -> FUND_MAIN`.
  - Tạo history event `GROUP_FUND_ADVANCE` có:
    - `balanceBeforeVnd`
    - `balanceAfterVnd`
    - `ledgerBatchId`
  - Fund balance âm được phép (không chặn âm).
  - Ghi audit `GROUP_FUND_ADVANCE`.
- Service flow:
  - `GroupFundService.createAdvance` transaction.
- Response success:
  - HTTP `201`
  - `data.batchId`
  - `data.event` (`GroupFundUnifiedHistoryItem`, `itemType="ADVANCE"`).
- Error cases:
  - `400 GROUP_FUND_ADVANCE_INVALID`
  - `422 GROUP_FUND_ADVANCE_INVALID`
  - `401/403`

## [Tạo Group-Fund History Event]
- Method: `POST`
- URL: `/api/v1/group-fund/history-events`
- Module: Group Fund
- Chức năng: Tạo non-match group-fund event dạng note.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Body:
    - `eventType`: `"GROUP_FUND_NOTE"`
    - `note`: string min1 max4000
    - `playerId?`: uuid
    - `postedAt?`: datetime
- Validate: discriminated union theo `eventType`.
- Business logic:
  - `note` bắt buộc sau trim.
  - `playerId` (nếu có) phải là active member.
  - Tạo `module_history_events` event type `GROUP_FUND_NOTE`.
  - Ghi audit `GROUP_FUND_HISTORY_EVENT`.
- Service flow:
  - `GroupFundService.createNoteEvent` transaction.
- Response success:
  - HTTP `201`, `data.event` (`itemType="NOTE"`).
- Error cases:
  - `400 GROUP_FUND_HISTORY_EVENT_INVALID`
  - `422 GROUP_FUND_HISTORY_EVENT_INVALID`
  - `401/403`

## [Tạo Manual Group-Fund Transaction]
- Method: `POST`
- URL: `/api/v1/group-fund/transactions`
- Module: Group Fund
- Chức năng: Tạo giao dịch thủ công quỹ nhóm.
- Authentication/Authorization: Yêu cầu JWT `ADMIN`.
- Request:
  - Path variables: Không
  - Query params: Không
  - Headers: `Authorization`, `Content-Type`
  - Body:
    - `transactionType`: `CONTRIBUTION|WITHDRAWAL|ADJUSTMENT_IN|ADJUSTMENT_OUT`
    - `playerId?` (`uuid|null`) với rule:
      - bắt buộc cho `CONTRIBUTION/WITHDRAWAL`
      - phải null cho `ADJUSTMENT_*`
    - `amountVnd` int>0
    - `reason` string min3 max500
    - `postedAt?` datetime
- Validate:
  - Zod + superRefine rule playerId theo transactionType.
- Business logic:
  - Resolve account source/destination theo transactionType.
  - Tạo ledger batch (`MANUAL_ADJUSTMENT` hoặc `SYSTEM_CORRECTION`) và 1 ledger entry.
  - Nếu là `ADJUSTMENT_IN/ADJUSTMENT_OUT` sẽ tạo history event `GROUP_FUND_ADJUSTMENT`.
  - Ghi audit.
- Service flow:
  - `GroupFundService.createManualTransaction` transaction.
- Response success:
  - HTTP `201`, `batchId`, `postedAt`, `sourceType`, `transactionType`, `playerId`, `playerName`, `amountVnd`, `reason`.
- Error cases:
  - `400 GROUP_FUND_PLAYER_REQUIRED`
  - `400 GROUP_FUND_PLAYER_NOT_ALLOWED`
  - `422 GROUP_FUND_PLAYER_INVALID`
  - `401/403`

## [Danh Sách Manual Group-Fund Transactions]
- Method: `GET`
- URL: `/api/v1/group-fund/transactions`
- Module: Group Fund
- Chức năng: List manual/system-correction transactions của group fund.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params:
    - `transactionType?`, `playerId?`, `from?`, `to?`, `page`, `pageSize`
  - Headers: Không
  - Body: Không
- Validate: query schema.
- Business logic:
  - Filter transaction type bằng CASE từ account type.
  - Chỉ lấy batch source type `MANUAL_ADJUSTMENT` hoặc `SYSTEM_CORRECTION`.
- Service flow:
  - `GroupFundService.listManualTransactions`.
- Response success:
  - `data`: `GroupFundTransactionResponse[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Unified Group-Fund History]
- Method: `GET`
- URL: `/api/v1/group-fund/history`
- Module: Group Fund
- Chức năng: Feed hợp nhất cho FE gồm match + manual transactions + advances + notes/adjustments/contributions.
- Authentication/Authorization: Public.
- Request:
  - Query params:
    - `playerId?`, `from?`, `to?`
    - `itemTypes?`: `MATCH|MANUAL_TRANSACTION|ADVANCE|NOTE|ADJUSTMENT|CONTRIBUTION`
      - hỗ trợ CSV hoặc multi query key
    - `page`, `pageSize`
- Validate: query schema.
- Business logic:
  - Hợp nhất 3 nguồn:
    - Match (`module=GROUP_FUND`)
    - Manual transactions chưa có linked history event (`itemType=MANUAL_TRANSACTION`)
    - `module_history_events` (`ADVANCE|NOTE|ADJUSTMENT|CONTRIBUTION`)
  - Sort ổn định: `postedAt DESC`, `createdAt DESC`, `id DESC`.
- Service flow:
  - `GroupFundService.getHistory` -> `HistoryEventRepository.listGroupFundHistory`.
- Response success:
  - `data`: `GroupFundUnifiedHistoryItem[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Group Fund Summary]
- Method: `GET`
- URL: `/api/v1/group-fund/summary`
- Module: Group Fund
- Chức năng: Tổng quan quỹ, nghĩa vụ player, số trận.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params: `from?`, `to?`
  - Headers: Không
  - Body: Không
- Validate: datetime query.
- Business logic:
  - `fundBalanceVnd` tính theo ledger entries module GROUP_FUND.
  - `totalMatches` lấy từ matches module GROUP_FUND.
  - Bổ sung aggregate từ history events:
    - `totalRegularContributionsVnd` (event `GROUP_FUND_CONTRIBUTION`)
    - `totalAdvancesVnd` (event `GROUP_FUND_ADVANCE`)
    - `advancesByPlayers[]`
    - `players[].totalAdvancedVnd`
  - `negativeBalanceAllowed` luôn `true`.
- Service flow:
  - `GroupFundService.getSummary`.
- Response success:
  - `data`: `GroupFundSummary`.
- Error cases:
  - `400 VALIDATION_ERROR`
- Ghi chú:
  - Theo implementation hiện tại, `from/to` được áp dụng cho:
    - `fundBalanceVnd`
    - `totalMatches`
    - aggregate history event (`totalRegularContributionsVnd`, `totalAdvancesVnd`, `advancesByPlayers`)
  - `players[]` vẫn lấy từ aggregate ledger summary hiện có của module.

## [Group Fund Ledger]
- Method: `GET`
- URL: `/api/v1/group-fund/ledger`
- Module: Group Fund
- Chức năng: Ledger entries cho module GROUP_FUND.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params: `playerId?`, `from?`, `to?`, `page`, `pageSize`
  - Headers: Không
  - Body: Không
- Validate: query schema.
- Business logic:
  - Map movementType:
    - `FUND_IN` nếu vào fund account
    - `FUND_OUT` nếu ra khỏi fund account
  - Derive `relatedPlayerId/Name` theo chiều movement.
- Service flow:
  - `GroupFundService.getLedger` + map ở route.
- Response success:
  - `data`: `GroupFundLedgerItem[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

## [Group Fund Match History]
- Method: `GET`
- URL: `/api/v1/group-fund/matches`
- Module: Group Fund
- Chức năng: Lịch sử match module GROUP_FUND.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params: `playerId?`, `ruleSetId?`, `from?`, `to?`, `page`, `pageSize`
  - Headers: Không
  - Body: Không
- Validate: query schema.
- Business logic:
  - Reuse `services.matches.listMatches` với `module="GROUP_FUND"`.
- Service flow:
  - Route -> `MatchService.listMatches`.
- Response success:
  - `data`: `GroupFundMatchHistoryItem[]`, `meta`.
- Error cases:
  - `400 VALIDATION_ERROR`

### 7.10 Dashboard

## [Dashboard Overview]
- Method: `GET`
- URL: `/api/v1/dashboard/overview`
- Module: Dashboard
- Chức năng: Tổng quan số lượng player, tổng match, top players, recent matches.
- Authentication/Authorization: Public.
- Request:
  - Path variables: Không
  - Query params: Không
  - Headers: Không
  - Body: Không
- Validate: Không input.
- Business logic:
  - Gọi song song nhiều service:
    - players total
    - matches total
    - matchStakes summary + total
    - groupFund summary + total
    - recent matches top 5
  - Sort top 5 theo:
    - match-stakes `totalNetVnd DESC`
    - group-fund `totalContributedVnd DESC`
- Service flow:
  - `registerDashboardRoutes` -> `Promise.all(...)`.
- Response success:
  - `data`: `DashboardOverviewResponse`.
- Error cases:
  - `500` nội bộ nếu sub-call lỗi.
- Ghi chú: Không cần token vì GET public policy.

## 8. Danh sách DTO/Schema/Model chính

### 8.1 Envelope chung
- Success:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
- Error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": {}
  }
}
```

### 8.2 Auth DTO
- `CheckAccessCodeBody`
  - `accessCode: string` (required)
- `LoginResponse`
  - `accessToken: string` (required)
  - `tokenType: "Bearer"` (required)
  - `expiresIn: int>0` (required, giây)
  - `role: "USER" | "ADMIN"` (required)

### 8.3 Player DTO
- `PlayerResponse`
  - `id: uuid`
  - `displayName: string`
  - `slug: string|null`
  - `avatarUrl: string|null`
  - `isActive: boolean`
  - `createdAt: datetime`
  - `updatedAt: datetime`
- `CreatePlayerBody`
  - `displayName` required, min1 max120
  - `slug?` nullable, max120
  - `avatarUrl?` nullable, url
  - `isActive?` default true

### 8.4 Rule DTO
- `RuleSetResponse`
  - `id, module, code, name, description, status, isDefault, createdAt, updatedAt`
- `RuleSetVersionResponse`
  - `id, ruleSetId, versionNo, description`
  - `participantCountMin`, `participantCountMax`
  - `effectiveFrom`, `effectiveTo`
  - `isActive`
  - `summaryJson`
  - `builderType`, `builderConfig`
  - `createdAt`
  - `rules[]`
- `RuleResponse`
  - `id, code, name, description, ruleKind, priority, status`
  - `stopProcessingOnMatch`
  - `metadata`
  - `conditions[]`, `actions[]`
- `RuleCondition`
  - `conditionKey`, `operator`, `valueJson`, `sortOrder`
- `RuleAction`
  - `actionType`, `amountVnd`
  - `sourceSelectorType`, `sourceSelectorJson`
  - `destinationSelectorType`, `destinationSelectorJson`
  - `descriptionTemplate`, `sortOrder`

### 8.5 Match DTO
- `ParticipantInput`
  - `playerId: uuid`
  - `tftPlacement: int`
- `CreateMatchConfirmation`
  - `mode: "ENGINE"|"MANUAL_ADJUSTED"`
  - `participantNets?[]`: `{ playerId, netVnd(int) }`
  - `overrideReason?`
- `MatchParticipantResponse`
  - `playerId`, `playerName`
  - `tftPlacement`, `relativeRank`
  - `isWinnerAmongParticipants?`
  - `settlementNetVnd`
- `SettlementLineResponse`
  - `id`, `lineNo`, `ruleId`, `ruleCode`, `ruleName`
  - `sourceAccountId`, `destinationAccountId`
  - `sourcePlayerId`, `sourcePlayerName`
  - `destinationPlayerId`, `destinationPlayerName`
  - `amountVnd`, `reasonText`, `metadata`
- `SettlementResponse`
  - `id`, totals, `engineVersion`, `ruleSnapshot`, `resultSnapshot`
  - `postedToLedgerAt`
  - `lines[]`
- `MatchDetailResponse`
  - metadata match
  - `confirmationMode`, `overrideReason`, `manualAdjusted`
  - `ruleSet`, `ruleSetVersion`
  - `participants[]`
  - `engineCalculationSnapshot`
  - `settlement`
  - `voidReason`, `voidedAt`

### 8.6 Debt period DTO
- `DebtPeriod`
  - `id`, `periodNo`, `title`, `note`, `closeNote`, `nextPeriodId`
  - `status: OPEN|CLOSED`
  - `openedAt`, `closedAt`
- `DebtPeriodSummary`
  - `totalMatches`, `totalPlayers`
  - `totalOutstandingReceiveVnd`
  - `totalOutstandingPayVnd`
- `DebtPeriodPlayerSummary`
  - `playerId`, `playerName`
  - `totalMatches`
  - `initNetVnd`, `accruedNetVnd`
  - `settledPaidVnd`, `settledReceivedVnd`
  - `outstandingNetVnd`
- `DebtSettlement`
  - `id`, `postedAt`, `note`, `createdAt`, `updatedAt`, `lines[]`
- `DebtTimelineItem`
  - `type: MATCH|INITIAL|ADVANCE|NOTE`
  - `matchId`, `eventId`, `eventType`
  - `playedAt`, `matchNo`, `participantCount`, `status`
  - `amountVnd`, `note`
  - `affectsDebt`, `impactMode`
  - `metadata`
  - `rows[]` (`playerId`, `playerName`, `tftPlacement`, `relativeRank`, `matchNetVnd`, `cumulativeNetVnd`)
- `CreateMatchStakesHistoryEventBody`
  - `eventType = "MATCH_STAKES_ADVANCE"`:
    - `postedAt?`, `playerId`, `amountVnd`, `note?`, `impactMode?`, `beneficiaryPlayerIds?`, `debtPeriodId?`
  - `eventType = "MATCH_STAKES_NOTE"`:
    - `postedAt?`, `note`, `playerId?`, `debtPeriodId?`
- `MatchStakesUnifiedHistoryItem`
  - `id`
  - `module: "MATCH_STAKES"`
  - `itemType: "MATCH"|"DEBT_SETTLEMENT"|"ADVANCE"|"NOTE"|string`
  - `postedAt`, `createdAt`
  - `title`, `description`
  - `amountVnd`
  - `player`, `secondaryPlayer`
  - `matchId`, `debtPeriodId`, `ledgerBatchId`
  - `balanceBeforeVnd`, `balanceAfterVnd`
  - `outstandingBeforeVnd`, `outstandingAfterVnd`
  - `note`
  - `metadata`

### 8.7 Group fund DTO
- `GroupFundTransactionResponse`
  - `entryId?`, `batchId`, `postedAt`, `sourceType`
  - `transactionType`
  - `playerId`, `playerName`
  - `amountVnd`
  - `reason`
- `MarkContributionResponse`
  - `batchId`, `postedAt`, `playerId`, `playerName`, `amountVnd`, `note`
- `GroupFundSummary`
  - `module`
  - `fundBalanceVnd`
  - `totalMatches`
  - `negativeBalanceAllowed` (`true`)
  - `totalRegularContributionsVnd`
  - `totalAdvancesVnd`
  - `advancesByPlayers[]`:
    - `playerId`, `playerName`, `totalAdvancedVnd`, `lastAdvancedAt`
  - `players[]`:
    - `playerId`, `playerName`
    - `totalContributedVnd`
    - `currentObligationVnd`
    - `netObligationVnd`
    - `prepaidVnd`
    - `totalAdvancedVnd`
  - `range.from`, `range.to`
- `CreateGroupFundAdvanceBody`
  - `playerId`, `amountVnd`, `note?`, `postedAt?`
- `CreateGroupFundHistoryEventBody`
  - hiện tại hỗ trợ:
    - `eventType: "GROUP_FUND_NOTE"`
    - `note`, `playerId?`, `postedAt?`
- `GroupFundUnifiedHistoryItem`
  - `id`
  - `module: "GROUP_FUND"`
  - `itemType: "MATCH"|"MANUAL_TRANSACTION"|"ADVANCE"|"NOTE"|"ADJUSTMENT"|"CONTRIBUTION"|string`
  - `postedAt`, `createdAt`
  - `title`, `description`
  - `amountVnd`
  - `player`, `secondaryPlayer`
  - `matchId`, `debtPeriodId`, `ledgerBatchId`
  - `balanceBeforeVnd`, `balanceAfterVnd`
  - `outstandingBeforeVnd`, `outstandingAfterVnd`
  - `note`
  - `metadata`

### 8.8 Dashboard DTO
- `DashboardOverviewResponse`
  - `playerCount`
  - `totalMatches`
  - `matchStakes.totalMatches`, `matchStakes.topPlayers[]`
  - `groupFund.totalMatches`, `groupFund.fundBalanceVnd`, `groupFund.topContributors[]`
  - `recentMatches[]`

### 8.9 Domain model chính (records)
- `GroupRecord`
- `RoleRecord`
- `PlayerRecord`
- `RuleSetRecord`
- `RuleSetVersionRecord`
- `RuleRecord`
- `MatchStakesDebtPeriodRecord`
- `ModuleHistoryEventRecord`
- `SettlementLineDraft`
- `LedgerEntryDraft`

## 9. Danh sách enum/constant/status quan trọng

### 9.1 Domain enum
- `module_type`: `MATCH_STAKES`, `GROUP_FUND`
- `match_status`: `DRAFT`, `CALCULATED`, `POSTED`, `VOIDED`
- `rule_status`: `ACTIVE`, `INACTIVE`
- `rule_kind`:
  - `BASE_RELATIVE_RANK`
  - `ABSOLUTE_PLACEMENT_MODIFIER`
  - `PAIR_CONDITION_MODIFIER`
  - `FUND_CONTRIBUTION`
  - `CUSTOM`
- `condition_operator`: `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `IN`, `NOT_IN`, `BETWEEN`, `CONTAINS`
- `action_type`: `TRANSFER`, `POST_TO_FUND`, `CREATE_OBLIGATION`, `REDUCE_OBLIGATION`
- `selector_type`:
  - `SUBJECT_PLAYER`
  - `PLAYER_BY_RELATIVE_RANK`
  - `PLAYER_BY_ABSOLUTE_PLACEMENT`
  - `MATCH_WINNER`
  - `MATCH_RUNNER_UP`
  - `BEST_PARTICIPANT`
  - `WORST_PARTICIPANT`
  - `FUND_ACCOUNT`
  - `SYSTEM_ACCOUNT`
  - `FIXED_PLAYER`
- `account_type`: `PLAYER_DEBT`, `FUND_MAIN`, `PLAYER_FUND_OBLIGATION`, `SYSTEM_HOLDING`
- `debt_period_status`: `OPEN`, `CLOSED`
- `history_event_type`:
  - `MATCH_STAKES_ADVANCE`
  - `MATCH_STAKES_NOTE`
  - `GROUP_FUND_ADVANCE`
  - `GROUP_FUND_NOTE`
  - `GROUP_FUND_ADJUSTMENT`
  - `GROUP_FUND_CONTRIBUTION`
- `match_stakes_impact_mode`: `INFORMATIONAL`, `AFFECTS_DEBT`

### 9.2 Auth/permission constants
- Role code:
  - `ADMIN`
  - `USER`
- Bearer token type: `"Bearer"`
- JWT header: `alg=HS256`, `typ=JWT`.

### 9.3 Rule builder
- `ruleBuilderType`: `MATCH_STAKES_PAYOUT`
- Penalty destination selector type:
  - `BEST_PARTICIPANT`
  - `MATCH_WINNER`
  - `FIXED_PLAYER`
  - `FUND_ACCOUNT`

### 9.4 Group-fund transaction type
- `CONTRIBUTION`
- `WITHDRAWAL`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`

## 10. Danh sách mã lỗi tổng hợp

### 10.1 Lỗi framework/chung
- `VALIDATION_ERROR` (400)
- `INTERNAL_ERROR` (500)
- `INTERNAL_SERVER_ERROR` (500 trong vercel handler fallback)

### 10.2 Auth
- `AUTH_UNAUTHORIZED` (401)
- `AUTH_FORBIDDEN` (403)
- `AUTH_ACCESS_CODE_INVALID` (401)
- `AUTH_LOGIN_INVALID` (400)
- `AUTH_ROLE_NOT_CONFIGURED` (500)

### 10.3 Group/System
- `GROUP_NOT_FOUND` (404)

### 10.4 Player
- `PLAYER_NOT_FOUND` (404)
- `PLAYER_DUPLICATE` (409)

### 10.5 Rule engine/rule set
- `RULE_SET_NOT_FOUND` (404)
- `RULE_SET_DEFAULT_NOT_FOUND` (404)
- `RULE_SET_DUPLICATE` (409)
- `RULE_SET_CODE_GENERATION_FAILED` (409)
- `RULE_SET_MODULE_IMMUTABLE` (400)
- `RULE_SET_CODE_IMMUTABLE` (400)
- `RULE_SET_VERSION_NOT_FOUND` (404)
- `RULE_SET_VERSION_INVALID` (400)
- `RULE_SET_VERSION_NOT_APPLICABLE` (422)
- `RULE_VERSION_NOT_FOUND` (404)
- `RULE_BUILDER_UNSUPPORTED_MODULE` (400)
- `RULE_BUILDER_INVALID_CONFIG` (400)
- `RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED` (400)
- `RULE_BUILDER_DUPLICATE_RANK` (400)
- `RULE_BUILDER_RANK_COVERAGE_INVALID` (400)
- `RULE_BUILDER_PAYOUT_LOSS_UNBALANCED` (400)
- `RULE_SELECTOR_INVALID` (400)
- `RULE_SELECTOR_NOT_FOUND` (400)

### 10.6 Match
- `MATCH_PARTICIPANT_COUNT_INVALID` (400)
- `MATCH_DUPLICATE_PLAYER` (400)
- `MATCH_DUPLICATE_PLACEMENT` (400)
- `MATCH_PLACEMENT_INVALID` (400)
- `MATCH_PLAYERS_INVALID` (422)
- `MATCH_RULE_SET_MODULE_MISMATCH` (422)
- `MATCH_CONFIRMATION_INVALID` (400)
- `MATCH_NOT_FOUND` (404)
- `MATCH_VOID_REASON_INVALID` (400)
- `MATCH_ALREADY_VOIDED` (422)

### 10.7 Match Stakes Debt
- `DEBT_PERIOD_NOT_FOUND` (404)
- `DEBT_PERIOD_OPEN_ALREADY_EXISTS` (409)
- `DEBT_PERIOD_NOT_OPEN` (422)
- `DEBT_SETTLEMENT_INVALID` (400/422 tùy ngữ cảnh)
- `DEBT_SETTLEMENT_OVERPAY` (422)
- `DEBT_PERIOD_CLOSING_BALANCE_INVALID` (400/422 tùy ngữ cảnh)
- `MATCH_STAKES_HISTORY_EVENT_INVALID` (400/422)
- `MATCH_STAKES_ADVANCE_INVALID` (400/422)

### 10.8 Group Fund
- `GROUP_FUND_PLAYER_REQUIRED` (400)
- `GROUP_FUND_PLAYER_NOT_ALLOWED` (400)
- `GROUP_FUND_PLAYER_INVALID` (422)
- `GROUP_FUND_ADVANCE_INVALID` (400/422)
- `GROUP_FUND_HISTORY_EVENT_INVALID` (400/422)

## 11. Rule nghiệp vụ quan trọng toàn hệ thống
- Tất cả write API `/api/v1/**` yêu cầu token `ADMIN`.
- GET/HEAD API `/api/v1/**` public theo policy hiện tại.
- Match participant chỉ hỗ trợ đúng 3 hoặc 4 người.
- `tftPlacement` phải unique và trong `[1..8]`.
- Match stakes manual adjusted bắt buộc tổng net = 0.
- Void match không xóa dữ liệu mà tạo ledger reversal.
- Rule set chỉnh sửa theo mô hình immutable version snapshot.
- Khi tạo version mới active, version active cũ bị `is_active=false`, đóng `effective_to`.
- Chỉ có 1 debt period OPEN cho mỗi group.
- Close debt period bắt buộc `closingBalances` normalize tổng bằng 0.
- Debt settlement không được làm overshoot outstanding.
- Match-stakes non-match history event chạy trên debt period `OPEN`.
- `MATCH_STAKES_ADVANCE` có 2 mode rõ ràng:
  - `INFORMATIONAL`: chỉ hiển thị lịch sử, không đổi outstanding.
  - `AFFECTS_DEBT`: cập nhật outstanding qua bảng impact theo player.
- Group-fund balance được phép âm (`negativeBalanceAllowed=true`).
- Group-fund unified history hợp nhất match + manual transaction + history event theo thời gian thực (`postedAt`).

### 11.1 Dependency giữa API
- `POST /api/v1/matches` phụ thuộc dữ liệu từ:
  - `players` (participant phải active),
  - `rule-sets` + `rule-set-versions` (resolve version áp dụng),
  - đồng thời cập nhật `recent-match-presets`, `ledger`, `audit`.
- `GET /api/v1/match-stakes/*` phụ thuộc match đã được tạo với `module=MATCH_STAKES` và ledger/debt tables.
- `POST /api/v1/match-stakes/debt-periods/:periodId/close` tạo dữ liệu đầu vào cho period kế tiếp (`init balances`), ảnh hưởng trực tiếp kỳ sau.
- `POST /api/v1/match-stakes/history-events` ghi vào `module_history_events`; nếu `AFFECTS_DEBT` còn ghi `match_stakes_history_event_player_impacts` và ảnh hưởng debt summary/timeline.
- `GET /api/v1/match-stakes/history` và `GET /api/v1/match-stakes/debt-periods/:periodId/history` phụ thuộc đồng thời `matches`, `match_stakes_debt_settlements`, `module_history_events`.
- `POST /api/v1/group-fund/contributions` gọi flow của `POST /api/v1/group-fund/transactions` với transaction type nội bộ `WITHDRAWAL`, đồng thời tạo history event `GROUP_FUND_CONTRIBUTION`.
- `POST /api/v1/group-fund/advances` ghi ledger batch + history event `GROUP_FUND_ADVANCE`, dùng cho `GET /api/v1/group-fund/history` và aggregate summary advance.
- `GET /api/v1/group-fund/history` hợp nhất dữ liệu từ `matches`, manual ledger transactions và `module_history_events`.

## 12. Điểm chưa xác định chắc chắn từ source
- `Chưa xác định chắc chắn từ source`: Swagger UI static assets cụ thể dưới `/docs/*` có thể thay đổi theo version package; source chỉ xác nhận các route chính `/docs`, `/docs/json`, `/docs/yaml`, `/docs/static/*`, wildcard asset.
- `Chưa xác định chắc chắn từ source`: HEAD route được Fastify tự sinh cho GET; source route khai báo chủ yếu GET nhưng runtime có thêm HEAD.
