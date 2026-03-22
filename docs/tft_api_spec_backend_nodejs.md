# Đặc tả API backend cho hệ thống LolChess TFT History Manager

## 1) Mục tiêu tài liệu

Tài liệu này mô tả các API backend cần thiết cho hệ thống **LolChess TFT History Manager** theo hướng:

- **BE**: Node.js + TypeScript
- **DB**: PostgreSQL
- **FE**: React + TypeScript
- ưu tiên triển khai **backend trước**
- API thiết kế đủ cho MVP nhưng vẫn mở rộng tốt cho rule engine, ledger, summary và preset nhập nhanh

Tài liệu này bám theo database hiện tại và phân tách rõ:

- API nào dùng để làm gì
- request DTO
- response DTO
- validation chính
- ghi chú triển khai service/controller

---

## 2) Công nghệ backend đề xuất

Để code Node.js gọn, rõ và dễ tách domain/service, đề xuất stack backend:

- **Node.js + TypeScript**
- **Fastify** hoặc **Express**
- **Drizzle ORM**
- **PostgreSQL**
- **Zod** cho validation DTO
- **REST API JSON**
- business logic tính toán đặt trong `domain/services`, không để rải ở controller

> Gợi ý:
> - Nếu muốn tốc độ dev tốt và typed schema rõ: **Fastify + Zod + Drizzle**
> - Nếu muốn quen tay, cộng đồng lớn: **Express + Zod + Drizzle**

Tài liệu API bên dưới không phụ thuộc chặt vào Fastify hay Express.

---

## 3) Phạm vi API cho MVP

### Bắt buộc nên có ngay

1. **System**
   - health check

2. **Players**
   - tạo / sửa / xóa mềm / danh sách / chi tiết

3. **Rule Sets**
   - danh sách
   - chi tiết
   - tạo rule set
   - sửa metadata
   - tạo version
   - bật / tắt
   - lấy rule set default theo module

4. **Matches**
   - tạo match
   - danh sách match
   - chi tiết match
   - void match

5. **Match Stakes**
   - summary
   - debt movement history
   - match history

6. **Group Fund**
   - summary
   - fund ledger history
   - match history

7. **Recent Preset**
   - đọc preset gần nhất
   - cập nhật preset sau khi tạo match

---

## 4) Quy ước API chung

## 4.1. Base URL

```text
/api/v1
```

Ví dụ:

```text
GET /api/v1/players
POST /api/v1/matches
GET /api/v1/match-stakes/summary
```

---

## 4.2. JSON naming

API dùng **camelCase** ở request/response.

Ví dụ:

- `playedAt`
- `ruleSetId`
- `participantCount`
- `totalTransferVnd`

Database có thể dùng `snake_case`, nhưng DTO API nên giữ `camelCase` để hợp FE React TS.

---

## 4.3. Tiền tệ

Tất cả tiền đều là **integer VND**.

```ts
type MoneyVnd = number;
```

Ví dụ:

- `100000`
- `50000`
- `10000`

Không dùng float.

---

## 4.4. Thời gian

Tất cả datetime qua API dùng ISO string.

Ví dụ:

```text
2026-03-22T14:30:00.000Z
```

Server lưu PostgreSQL `timestamptz`.

---

## 4.5. Response envelope chuẩn

Khuyến nghị dùng response envelope thống nhất:

```ts
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

Ví dụ thành công:

```json
{
  "success": true,
  "data": {
    "id": "pl_01",
    "displayName": "An"
  }
}
```

Ví dụ lỗi:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Participants must contain 3 or 4 unique players"
  }
}
```

---

## 4.6. Pagination query chuẩn

Khuyến nghị dùng:

- `page`
- `pageSize`

Mặc định:

- `page = 1`
- `pageSize = 20`

---

## 4.7. Filter query chuẩn

Các API list/history nên hỗ trợ dần:

- `module`
- `playerId`
- `ruleSetId`
- `from`
- `to`
- `page`
- `pageSize`

---

## 5) Common DTOs dùng lại nhiều nơi

## 5.1. Enums

```ts
type ModuleType = "MATCH_STAKES" | "GROUP_FUND";

type MatchStatus = "DRAFT" | "CALCULATED" | "POSTED" | "VOIDED";

type RuleStatus = "ACTIVE" | "INACTIVE";

type RuleKind =
  | "BASE_RELATIVE_RANK"
  | "ABSOLUTE_PLACEMENT_MODIFIER"
  | "PAIR_CONDITION_MODIFIER"
  | "FUND_CONTRIBUTION"
  | "CUSTOM";

type AccountType =
  | "PLAYER_DEBT"
  | "FUND_MAIN"
  | "PLAYER_FUND_OBLIGATION"
  | "SYSTEM_HOLDING";
```

---

## 5.2. Player DTO

```ts
interface PlayerDto {
  id: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5.3. Match participant DTO

```ts
interface MatchParticipantDto {
  playerId: string;
  playerName: string;
  tftPlacement: number;          // 1..8
  relativeRank: number;          // 1..participantCount
  isWinnerAmongParticipants: boolean;
  settlementNetVnd: number;
}
```

---

## 5.4. Settlement line DTO

```ts
interface MatchSettlementLineDto {
  id: string;
  lineNo: number;
  ruleId: string | null;
  ruleCode: string;
  ruleName: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourcePlayerId: string | null;
  sourcePlayerName: string | null;
  destinationPlayerId: string | null;
  destinationPlayerName: string | null;
  amountVnd: number;
  reasonText: string;
  metadata: Record<string, unknown> | null;
}
```

---

## 5.5. Rule DTO

```ts
interface RuleConditionDto {
  id: string;
  conditionKey: string;
  operator: string;
  valueJson: unknown;
  sortOrder: number;
}

interface RuleActionDto {
  id: string;
  actionType: string;
  amountVnd: number;
  sourceSelectorType: string;
  sourceSelectorJson: unknown | null;
  destinationSelectorType: string;
  destinationSelectorJson: unknown | null;
  descriptionTemplate: string | null;
  sortOrder: number;
}

interface RuleDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ruleKind: RuleKind;
  priority: number;
  status: RuleStatus;
  stopProcessingOnMatch: boolean;
  metadata: Record<string, unknown> | null;
  conditions: RuleConditionDto[];
  actions: RuleActionDto[];
}
```

---

## 6) SYSTEM APIs

## 6.1. Health check

### `GET /api/v1/health`

### Tác dụng
- kiểm tra backend còn sống
- dùng cho local, Docker, deploy health check

### Request DTO
Không có.

### Response DTO

```ts
interface HealthResponse {
  status: "ok";
  service: "tft-history-api";
  timestamp: string;
}
```

### Response example

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "tft-history-api",
    "timestamp": "2026-03-22T07:00:00.000Z"
  }
}
```

---

## 7) PLAYER APIs

## 7.1. Lấy danh sách players

### `GET /api/v1/players`

### Tác dụng
- lấy danh sách người chơi cho màn player management
- lấy danh sách người chơi active để tạo match

### Query params

```ts
interface GetPlayersQuery {
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
type GetPlayersResponse = PlayerDto[];
```

### Ghi chú
- `search` nên match theo `displayName`
- mặc định nên trả `isActive=true` nếu là màn tạo match

---

## 7.2. Tạo player

### `POST /api/v1/players`

### Tác dụng
- tạo người chơi mới

### Request DTO

```ts
interface CreatePlayerRequest {
  displayName: string;
  slug?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}
```

### Validation
- `displayName`: bắt buộc, 1..120 ký tự
- `slug`: optional, unique nếu có

### Response DTO

```ts
type CreatePlayerResponse = PlayerDto;
```

---

## 7.3. Lấy chi tiết player

### `GET /api/v1/players/:playerId`

### Tác dụng
- lấy chi tiết player để edit hoặc xem hồ sơ cơ bản

### Response DTO

```ts
type GetPlayerDetailResponse = PlayerDto;
```

---

## 7.4. Cập nhật player

### `PATCH /api/v1/players/:playerId`

### Tác dụng
- sửa tên hiển thị, avatar, active status

### Request DTO

```ts
interface UpdatePlayerRequest {
  displayName?: string;
  slug?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}
```

### Response DTO

```ts
type UpdatePlayerResponse = PlayerDto;
```

---

## 7.5. Xóa mềm player

### `DELETE /api/v1/players/:playerId`

### Tác dụng
- soft delete / deactivate player
- khuyến nghị không hard delete nếu player đã có match lịch sử

### Response DTO

```ts
interface DeletePlayerResponse {
  id: string;
  isActive: false;
}
```

### Ghi chú
- backend nên chuyển thành `isActive=false`
- nếu muốn hard delete thật, chỉ cho khi player chưa phát sinh dữ liệu liên quan

---

## 8) RULE SET APIs

## 8.1. Lấy danh sách rule sets

### `GET /api/v1/rule-sets`

### Tác dụng
- màn hình danh sách Rules
- dropdown chọn rule set khi tạo match

### Query params

```ts
interface GetRuleSetsQuery {
  module?: ModuleType;
  status?: RuleStatus;
  isDefault?: boolean;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
interface RuleSetListItemDto {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: RuleStatus;
  isDefault: boolean;
  activeVersionId: string | null;
  activeVersionNo: number | null;
  createdAt: string;
  updatedAt: string;
}

type GetRuleSetsResponse = RuleSetListItemDto[];
```

---

## 8.2. Tạo rule set

### `POST /api/v1/rule-sets`

### Tác dụng
- tạo metadata rule set mới
- ví dụ: `Match Stakes - Default`, `Group Fund - Default`

### Request DTO

```ts
interface CreateRuleSetRequest {
  module: ModuleType;
  code: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  status?: RuleStatus;
}
```

### Response DTO

```ts
interface RuleSetDto {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: RuleStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

type CreateRuleSetResponse = RuleSetDto;
```

---

## 8.3. Lấy chi tiết rule set

### `GET /api/v1/rule-sets/:ruleSetId`

### Tác dụng
- xem metadata của rule set
- xem các versions của rule set đó

### Response DTO

```ts
interface RuleSetVersionListItemDto {
  id: string;
  versionNo: number;
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown | null;
  createdAt: string;
}

interface GetRuleSetDetailResponse {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: RuleStatus;
  isDefault: boolean;
  versions: RuleSetVersionListItemDto[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 8.4. Cập nhật rule set metadata

### `PATCH /api/v1/rule-sets/:ruleSetId`

### Tác dụng
- sửa tên, mô tả, default flag, status của rule set
- không sửa rule logic tại đây

### Request DTO

```ts
interface UpdateRuleSetRequest {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  status?: RuleStatus;
}
```

### Response DTO

```ts
type UpdateRuleSetResponse = RuleSetDto;
```

---

## 8.5. Tạo version mới cho rule set

### `POST /api/v1/rule-sets/:ruleSetId/versions`

### Tác dụng
- thêm version mới của rule set
- đây là API quan trọng nhất để chỉnh luật mà không phá lịch sử

### Request DTO

```ts
interface CreateRuleSetVersionRequest {
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  summaryJson?: Record<string, unknown> | null;
  rules: Array<{
    code: string;
    name: string;
    description?: string | null;
    ruleKind: RuleKind;
    priority?: number;
    status?: RuleStatus;
    stopProcessingOnMatch?: boolean;
    metadata?: Record<string, unknown> | null;
    conditions: Array<{
      conditionKey: string;
      operator: string;
      valueJson: unknown;
      sortOrder?: number;
    }>;
    actions: Array<{
      actionType: string;
      amountVnd: number;
      sourceSelectorType: string;
      sourceSelectorJson?: unknown | null;
      destinationSelectorType: string;
      destinationSelectorJson?: unknown | null;
      descriptionTemplate?: string | null;
      sortOrder?: number;
    }>;
  }>;
}
```

### Response DTO

```ts
interface RuleSetVersionDetailDto {
  id: string;
  ruleSetId: string;
  versionNo: number;
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown | null;
  rules: RuleDto[];
  createdAt: string;
}

type CreateRuleSetVersionResponse = RuleSetVersionDetailDto;
```

### Ghi chú
- backend tự tăng `versionNo`
- rule set version cũ vẫn giữ nguyên
- rất phù hợp cho Node.js service layer kiểu:
  - create version row
  - insert rules
  - insert conditions/actions

---

## 8.6. Lấy chi tiết version của rule set

### `GET /api/v1/rule-sets/:ruleSetId/versions/:versionId`

### Tác dụng
- màn chi tiết version
- FE load đầy đủ conditions/actions để edit UI

### Response DTO

```ts
type GetRuleSetVersionDetailResponse = RuleSetVersionDetailDto;
```

---

## 8.7. Cập nhật active/inactive cho version

### `PATCH /api/v1/rule-sets/:ruleSetId/versions/:versionId`

### Tác dụng
- bật / tắt một version
- có thể chỉnh effectiveTo, summaryJson
- không khuyến nghị sửa sâu logic rules trong place
- nếu sửa logic lớn, nên tạo version mới

### Request DTO

```ts
interface UpdateRuleSetVersionRequest {
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  summaryJson?: Record<string, unknown> | null;
}
```

### Response DTO

```ts
type UpdateRuleSetVersionResponse = RuleSetVersionDetailDto;
```

---

## 8.8. Lấy default rule set theo module

### `GET /api/v1/rule-sets/default/by-module/:module`

### Tác dụng
- phục vụ quick match entry
- FE vào màn Match Stakes hoặc Group Fund có thể load rule set mặc định

### Response DTO

```ts
interface GetDefaultRuleSetByModuleResponse {
  ruleSet: RuleSetDto;
  activeVersion: RuleSetVersionDetailDto | null;
}
```

---

## 9) MATCH APIs

## 9.1. Tạo match và tính settlement ngay

### `POST /api/v1/matches`

### Tác dụng
- tạo match
- lưu participants
- tính settlement
- post ledger
- cập nhật recent preset
- đây là API nghiệp vụ quan trọng nhất

### Request DTO

```ts
interface CreateMatchRequest {
  module: ModuleType;
  playedAt: string;
  ruleSetId: string;
  ruleSetVersionId?: string; // optional, server có thể tự resolve active version
  note?: string | null;
  participants: Array<{
    playerId: string;
    tftPlacement: number; // 1..8, unique trong match
  }>;
}
```

### Validation chính
- `module` bắt buộc
- `participants.length` phải là `3` hoặc `4`
- `playerId` không được trùng
- `tftPlacement` không được trùng
- `tftPlacement` trong `1..8`
- rule set phải thuộc đúng module
- version phải phù hợp participant count và effective window

### Response DTO

```ts
interface CreateMatchResponse {
  id: string;
  module: ModuleType;
  playedAt: string;
  ruleSetId: string;
  ruleSetVersionId: string;
  participantCount: number;
  status: MatchStatus;
  notePreview: string | null;
  participants: MatchParticipantDto[];
  settlement: {
    id: string;
    totalTransferVnd: number;
    totalFundInVnd: number;
    totalFundOutVnd: number;
    engineVersion: string;
    lines: MatchSettlementLineDto[];
    postedToLedgerAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Ghi chú triển khai
Service `createMatch()` nên làm trong transaction:

1. insert `matches`
2. insert `match_participants`
3. insert `match_notes` nếu có
4. resolve rules/version
5. chạy calculation engine
6. insert `match_settlements`
7. insert `match_settlement_lines`
8. insert `ledger_entry_batches`
9. insert `ledger_entries`
10. update `recent_match_presets`

---

## 9.2. Lấy danh sách match

### `GET /api/v1/matches`

### Tác dụng
- màn Match History tổng quát
- filter theo module, player, rule set, time range

### Query params

```ts
interface GetMatchesQuery {
  module?: ModuleType;
  playerId?: string;
  ruleSetId?: string;
  status?: MatchStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
interface MatchListItemDto {
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  ruleSetId: string;
  ruleSetName: string;
  ruleSetVersionId: string;
  ruleSetVersionNo: number;
  notePreview: string | null;
  status: MatchStatus;
  participants: Array<{
    playerId: string;
    playerName: string;
    tftPlacement: number;
    relativeRank: number;
    settlementNetVnd: number;
  }>;
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  createdAt: string;
}

type GetMatchesResponse = MatchListItemDto[];
```

---

## 9.3. Lấy chi tiết match

### `GET /api/v1/matches/:matchId`

### Tác dụng
- màn match detail
- xem participants, note, settlement breakdown, rule version đã áp dụng

### Response DTO

```ts
interface GetMatchDetailResponse {
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  status: MatchStatus;
  note: string | null;
  ruleSet: {
    id: string;
    name: string;
    module: ModuleType;
  };
  ruleSetVersion: {
    id: string;
    versionNo: number;
    participantCountMin: number;
    participantCountMax: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  participants: MatchParticipantDto[];
  settlement: {
    id: string;
    totalTransferVnd: number;
    totalFundInVnd: number;
    totalFundOutVnd: number;
    engineVersion: string;
    ruleSnapshot: unknown;
    resultSnapshot: unknown;
    postedToLedgerAt: string | null;
    lines: MatchSettlementLineDto[];
  };
  createdAt: string;
  updatedAt: string;
}
```

---

## 9.4. Void match

### `POST /api/v1/matches/:matchId/void`

### Tác dụng
- hủy một match đã post sai
- backend có thể:
  - đánh dấu match `VOIDED`
  - tạo reversal batch vào ledger, hoặc
  - chặn void nếu chưa hỗ trợ reversal

### Request DTO

```ts
interface VoidMatchRequest {
  reason: string;
}
```

### Response DTO

```ts
interface VoidMatchResponse {
  id: string;
  status: "VOIDED";
  voidedAt: string;
  reason: string;
}
```

### Ghi chú
- Nếu làm chuẩn accounting, nên tạo reversal entries thay vì xóa cứng ledger cũ
- đây là hướng tốt cho backend Node.js production-ready

---

## 10) RECENT PRESET APIs

## 10.1. Lấy preset gần nhất theo module

### `GET /api/v1/recent-match-presets/:module`

### Tác dụng
- mở form quick match entry và prefill người chơi / rule gần nhất

### Response DTO

```ts
interface GetRecentMatchPresetResponse {
  module: ModuleType;
  lastRuleSetId: string | null;
  lastRuleSetVersionId: string | null;
  lastSelectedPlayerIds: string[];
  lastParticipantCount: number | null;
  lastUsedAt: string | null;
}
```

### Ghi chú
- Match Stakes và Group Fund nên nhớ preset riêng

---

## 10.2. Upsert preset gần nhất

### `PUT /api/v1/recent-match-presets/:module`

### Tác dụng
- update preset gần nhất
- thường backend tự gọi sau `POST /matches`
- FE không nhất thiết phải gọi trực tiếp, nhưng nên có API này để dễ test / admin / fallback

### Request DTO

```ts
interface UpsertRecentMatchPresetRequest {
  lastRuleSetId?: string | null;
  lastRuleSetVersionId?: string | null;
  lastSelectedPlayerIds: string[];
  lastParticipantCount: number;
}
```

### Response DTO

```ts
type UpsertRecentMatchPresetResponse = GetRecentMatchPresetResponse;
```

---

## 11) MATCH STAKES APIs

## 11.1. Lấy summary Match Stakes

### `GET /api/v1/match-stakes/summary`

### Tác dụng
- top section của màn Match Stakes
- hiển thị overall group debt
- tổng lời/lỗ theo player
- số trận, số lần đứng đầu trong nhóm tham gia, số lần thua nhiều nhất

### Query params

```ts
interface GetMatchStakesSummaryQuery {
  from?: string;
  to?: string;
}
```

### Response DTO

```ts
interface MatchStakesPlayerSummaryDto {
  playerId: string;
  playerName: string;
  totalNetVnd: number;
  totalMatches: number;
  firstPlaceCountAmongParticipants: number;
  biggestLossCount: number;
}

interface DebtSuggestionDto {
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  amountVnd: number;
}

interface GetMatchStakesSummaryResponse {
  module: "MATCH_STAKES";
  players: MatchStakesPlayerSummaryDto[];
  debtSuggestions: DebtSuggestionDto[];
  totalMatches: number;
  range: {
    from: string | null;
    to: string | null;
  };
}
```

### Ghi chú
- `debtSuggestions` là output tính toán thêm ở service layer, không nhất thiết có ngay ngày đầu
- nếu chưa implement settle suggestion, có thể trả `[]`

---

## 11.2. Lấy debt movement history

### `GET /api/v1/match-stakes/ledger`

### Tác dụng
- tab `Debt movement history`
- hiển thị lịch sử biến động nợ của Match Stakes

### Query params

```ts
interface GetMatchStakesLedgerQuery {
  playerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
interface MatchStakesLedgerItemDto {
  entryId: string;
  postedAt: string;
  matchId: string | null;
  sourcePlayerId: string | null;
  sourcePlayerName: string | null;
  destinationPlayerId: string | null;
  destinationPlayerName: string | null;
  amountVnd: number;
  entryReason: string;
  ruleCode: string | null;
  ruleName: string | null;
}

type GetMatchStakesLedgerResponse = MatchStakesLedgerItemDto[];
```

### Ghi chú
- dữ liệu chính lấy từ `ledger_entries`
- join với `match_settlement_lines`, `ledger_accounts`, `players`

---

## 11.3. Lấy match history riêng cho Match Stakes

### `GET /api/v1/match-stakes/matches`

### Tác dụng
- tab `Match Stakes match history`
- chỉ trả match thuộc module `MATCH_STAKES`

### Query params

```ts
interface GetMatchStakesMatchesQuery {
  playerId?: string;
  ruleSetId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
type GetMatchStakesMatchesResponse = MatchListItemDto[];
```

---

## 12) GROUP FUND APIs

## 12.1. Lấy summary Group Fund

### `GET /api/v1/group-fund/summary`

### Tác dụng
- top section của màn Group Fund
- hiển thị:
  - current fund balance
  - tổng đóng góp theo player
  - số tiền player đang nợ quỹ

### Query params

```ts
interface GetGroupFundSummaryQuery {
  from?: string;
  to?: string;
}
```

### Response DTO

```ts
interface GroupFundPlayerSummaryDto {
  playerId: string;
  playerName: string;
  totalContributedVnd: number;
  currentObligationVnd: number;
}

interface GetGroupFundSummaryResponse {
  module: "GROUP_FUND";
  fundBalanceVnd: number;
  totalMatches: number;
  players: GroupFundPlayerSummaryDto[];
  range: {
    from: string | null;
    to: string | null;
  };
}
```

---

## 12.2. Lấy fund ledger history

### `GET /api/v1/group-fund/ledger`

### Tác dụng
- tab `Fund increase/decrease history`
- hiển thị lịch sử tiền vào / ra quỹ

### Query params

```ts
interface GetGroupFundLedgerQuery {
  playerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
interface GroupFundLedgerItemDto {
  entryId: string;
  postedAt: string;
  matchId: string | null;
  relatedPlayerId: string | null;
  relatedPlayerName: string | null;
  amountVnd: number;
  movementType: "FUND_IN" | "FUND_OUT";
  entryReason: string;
  ruleCode: string | null;
  ruleName: string | null;
}

type GetGroupFundLedgerResponse = GroupFundLedgerItemDto[];
```

### Ghi chú
- `movementType`
  - `FUND_IN`: tiền vào quỹ
  - `FUND_OUT`: tiền ra quỹ

---

## 12.3. Lấy match history riêng cho Group Fund

### `GET /api/v1/group-fund/matches`

### Tác dụng
- tab `Group Fund match history`
- chỉ trả match thuộc module `GROUP_FUND`

### Query params

```ts
interface GetGroupFundMatchesQuery {
  playerId?: string;
  ruleSetId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
```

### Response DTO

```ts
type GetGroupFundMatchesResponse = MatchListItemDto[];
```

---

## 13) DASHBOARD API

## 13.1. Lấy dashboard overview

### `GET /api/v1/dashboard/overview`

### Tác dụng
- nếu FE có trang home dashboard
- gom nhanh các số chính cho cả 2 module

### Response DTO

```ts
interface DashboardOverviewResponse {
  playerCount: number;
  totalMatches: number;
  matchStakes: {
    totalMatches: number;
    topPlayers: Array<{
      playerId: string;
      playerName: string;
      totalNetVnd: number;
    }>;
  };
  groupFund: {
    totalMatches: number;
    fundBalanceVnd: number;
    topContributors: Array<{
      playerId: string;
      playerName: string;
      totalContributedVnd: number;
    }>;
  };
  recentMatches: MatchListItemDto[];
}
```

### Ghi chú
- API này tiện cho FE nhưng không bắt buộc có ngay ngày đầu
- nếu backend đang build trước, có thể để sau

---

## 14) API mapping theo màn hình FE

## 14.1. Player Management

- `GET /players`
- `POST /players`
- `GET /players/:playerId`
- `PATCH /players/:playerId`
- `DELETE /players/:playerId`

---

## 14.2. Quick Match Entry

- `GET /recent-match-presets/:module`
- `GET /players?isActive=true`
- `GET /rule-sets?module=MATCH_STAKES`
- `GET /rule-sets?module=GROUP_FUND`
- `POST /matches`

---

## 14.3. Match Detail

- `GET /matches/:matchId`

---

## 14.4. Rules Screen

- `GET /rule-sets`
- `POST /rule-sets`
- `GET /rule-sets/:ruleSetId`
- `PATCH /rule-sets/:ruleSetId`
- `POST /rule-sets/:ruleSetId/versions`
- `GET /rule-sets/:ruleSetId/versions/:versionId`
- `PATCH /rule-sets/:ruleSetId/versions/:versionId`

---

## 14.5. Match Stakes Screen

- `GET /match-stakes/summary`
- `GET /match-stakes/ledger`
- `GET /match-stakes/matches`

---

## 14.6. Group Fund Screen

- `GET /group-fund/summary`
- `GET /group-fund/ledger`
- `GET /group-fund/matches`

---

## 15) Validation rules quan trọng ở backend Node.js

## 15.1. Tạo player

- `displayName` không rỗng
- `slug` nếu có thì unique

---

## 15.2. Tạo rule set version

- `participantCountMin <= participantCountMax`
- `rules.length > 0`
- mỗi `rule.code` unique trong version
- `amountVnd >= 0`

---

## 15.3. Tạo match

- số player phải là 3 hoặc 4
- player không trùng nhau
- placement không trùng nhau
- placement trong 1..8
- rule set đúng module
- version active và hợp lệ theo thời gian / participant count
- nếu `module = MATCH_STAKES`, engine phải sinh ra ledger line giữa player accounts
- nếu `module = GROUP_FUND`, engine phải sinh ra ledger line có đích/quy chiếu về fund account

---

## 15.4. Void match

- match chưa bị void trước đó
- nếu đã post ledger, phải có reversal strategy
- không được xóa cứng dữ liệu accounting đã phát sinh

---

## 16) HTTP status code khuyến nghị

- `200 OK`: lấy dữ liệu / update thành công
- `201 Created`: tạo mới thành công
- `400 Bad Request`: request sai định dạng / validation fail
- `404 Not Found`: không tìm thấy tài nguyên
- `409 Conflict`: conflict business, ví dụ duplicate slug, duplicate rule code
- `422 Unprocessable Entity`: hợp lệ về format nhưng sai nghiệp vụ
- `500 Internal Server Error`: lỗi hệ thống

---

## 17) Thứ tự code backend Node.js khuyến nghị

Vì bạn đang tập trung code Node.js trước, nên triển khai API theo thứ tự này:

### Phase 1: nền tảng
1. `GET /health`
2. `GET /players`
3. `POST /players`
4. `PATCH /players/:playerId`
5. `DELETE /players/:playerId`

### Phase 2: rules
6. `GET /rule-sets`
7. `POST /rule-sets`
8. `GET /rule-sets/:ruleSetId`
9. `POST /rule-sets/:ruleSetId/versions`
10. `GET /rule-sets/default/by-module/:module`

### Phase 3: core match flow
11. `GET /recent-match-presets/:module`
12. `POST /matches`
13. `GET /matches`
14. `GET /matches/:matchId`

### Phase 4: summary/history
15. `GET /match-stakes/summary`
16. `GET /match-stakes/ledger`
17. `GET /match-stakes/matches`
18. `GET /group-fund/summary`
19. `GET /group-fund/ledger`
20. `GET /group-fund/matches`

### Phase 5: operational safety
21. `POST /matches/:matchId/void`
22. `PUT /recent-match-presets/:module`

---

## 18) Danh sách endpoint rút gọn cho MVP

```text
GET    /api/v1/health

GET    /api/v1/players
POST   /api/v1/players
GET    /api/v1/players/:playerId
PATCH  /api/v1/players/:playerId
DELETE /api/v1/players/:playerId

GET    /api/v1/rule-sets
POST   /api/v1/rule-sets
GET    /api/v1/rule-sets/:ruleSetId
PATCH  /api/v1/rule-sets/:ruleSetId
POST   /api/v1/rule-sets/:ruleSetId/versions
GET    /api/v1/rule-sets/:ruleSetId/versions/:versionId
PATCH  /api/v1/rule-sets/:ruleSetId/versions/:versionId
GET    /api/v1/rule-sets/default/by-module/:module

POST   /api/v1/matches
GET    /api/v1/matches
GET    /api/v1/matches/:matchId
POST   /api/v1/matches/:matchId/void

GET    /api/v1/recent-match-presets/:module
PUT    /api/v1/recent-match-presets/:module

GET    /api/v1/match-stakes/summary
GET    /api/v1/match-stakes/ledger
GET    /api/v1/match-stakes/matches

GET    /api/v1/group-fund/summary
GET    /api/v1/group-fund/ledger
GET    /api/v1/group-fund/matches
```

---

## 19) Kết luận

Bộ API trên đủ để backend Node.js triển khai trọn flow MVP:

- quản lý player
- quản lý rule set và version
- tạo match 3/4 người
- chọn module `MATCH_STAKES` hoặc `GROUP_FUND`
- chọn rule set
- lưu placement TFT
- tính settlement ngay khi tạo match
- lưu ledger phục vụ history và summary
- đọc preset gần nhất để nhập nhanh
- xem summary riêng cho `Match Stakes` và `Group Fund`

Nếu đi tiếp bước code backend, tài liệu này là đủ để bắt đầu tạo:

- `routes`
- `controllers`
- `zod dto schemas`
- `services`
- `repositories`
- `domain calculation engine`

