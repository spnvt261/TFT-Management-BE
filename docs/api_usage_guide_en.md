# TFT History API Usage Guide (English)

This guide is written from the current source code in `apps/api` and describes:

- Which APIs exist.
- Request/response DTOs.
- Business purpose.
- Processing flow and key validation logic.

## 1. System Overview

- Runtime: Node.js + TypeScript + Fastify.
- Base API prefix: `/api/v1`.
- Swagger UI: `GET /docs`.
- OpenAPI JSON: `GET /docs/json`.
- Health routes:
  - `GET /` (service readiness quick check).
  - `GET /api/v1/health`.
- Data scope: all endpoints run under one default group resolved at startup by `DEFAULT_GROUP_CODE` (no group id in API requests).

### Startup lifecycle

1. Ensure database exists (if `DB_BOOTSTRAP_ENABLED=true`).
2. Run Flyway migrations (if `FLYWAY_ENABLED=true` and Flyway CLI exists).
3. Start HTTP server.

## 2. Common API Conventions

### 2.1 Success envelope

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
```

### 2.2 Error envelope

```ts
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### 2.3 Common status codes

- `200` success.
- `201` created.
- `400` validation or bad request.
- `404` not found.
- `409` conflict.
- `422` business rule violation.
- `500` unexpected server error.

### 2.4 Common pagination query

```ts
interface PaginationQuery {
  page?: number; // default 1
  pageSize?: number; // default 20, max 100
}
```

### 2.5 Core enums

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

type RuleBuilderType = "MATCH_STAKES_PAYOUT";

type ConditionOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "NOT_IN" | "BETWEEN" | "CONTAINS";

type SelectorType =
  | "SUBJECT_PLAYER"
  | "PLAYER_BY_RELATIVE_RANK"
  | "PLAYER_BY_ABSOLUTE_PLACEMENT"
  | "MATCH_WINNER"
  | "MATCH_RUNNER_UP"
  | "BEST_PARTICIPANT"
  | "WORST_PARTICIPANT"
  | "FUND_ACCOUNT"
  | "SYSTEM_ACCOUNT"
  | "FIXED_PLAYER";

type MatchStakesPenaltyDestinationSelectorType =
  | "BEST_PARTICIPANT"
  | "MATCH_WINNER"
  | "FIXED_PLAYER"
  | "FUND_ACCOUNT";
```

## 3. Endpoint Catalog

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service ready check |
| GET | `/api/v1/health` | Health status |
| GET | `/api/v1/players` | List players |
| POST | `/api/v1/players` | Create player |
| GET | `/api/v1/players/:playerId` | Player detail |
| PATCH | `/api/v1/players/:playerId` | Update player |
| DELETE | `/api/v1/players/:playerId` | Soft delete player |
| GET | `/api/v1/rule-sets` | List rule sets |
| POST | `/api/v1/rule-sets` | Create rule (creates rule set + first version) |
| GET | `/api/v1/rule-sets/:ruleSetId` | Rule set detail |
| PATCH | `/api/v1/rule-sets/:ruleSetId` | Edit rule (creates new immutable version) |
| GET | `/api/v1/rule-sets/default/by-module/:module` | Default rule set by module |
| POST | `/api/v1/matches/preview` | Preview settlement (no persistence) |
| POST | `/api/v1/matches` | Create match from engine/manual confirmed nets, then post ledger |
| GET | `/api/v1/matches` | List matches |
| GET | `/api/v1/matches/:matchId` | Match detail |
| POST | `/api/v1/matches/:matchId/void` | Void match + reversal ledger entries |
| GET | `/api/v1/recent-match-presets/:module` | Get recent preset by module |
| PUT | `/api/v1/recent-match-presets/:module` | Upsert recent preset by module |
| GET | `/api/v1/match-stakes/summary` | Match Stakes summary |
| GET | `/api/v1/match-stakes/ledger` | Match Stakes ledger history |
| GET | `/api/v1/match-stakes/matches` | Match Stakes match history |
| POST | `/api/v1/group-fund/transactions` | Create manual Group Fund transaction |
| GET | `/api/v1/group-fund/transactions` | List manual Group Fund transactions |
| GET | `/api/v1/group-fund/summary` | Group Fund summary |
| GET | `/api/v1/group-fund/ledger` | Group Fund ledger history |
| GET | `/api/v1/group-fund/matches` | Group Fund match history |
| GET | `/api/v1/dashboard/overview` | Dashboard overview |

## 4. Shared DTOs

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

interface MatchParticipantDto {
  playerId: string;
  playerName: string;
  tftPlacement: number;
  relativeRank: number;
  isWinnerAmongParticipants?: boolean;
  settlementNetVnd: number;
}

interface SettlementLineDto {
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
  metadata: unknown;
}

interface SettlementDto {
  id: string;
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  engineVersion: string;
  ruleSnapshot: unknown;
  resultSnapshot: unknown;
  postedToLedgerAt: string | null;
  lines: SettlementLineDto[];
}
```

## 5. API Details

## 5.1 System APIs

### GET `/`

Business purpose: simple readiness ping.

Request DTO: none.

Response DTO:

```ts
{
  success: true,
  data: {
    service: "tft-history-api",
    status: "ready"
  }
}
```

Processing flow:

1. Return static JSON payload.

### GET `/api/v1/health`

Business purpose: service health check with timestamp.

Request DTO: none.

Response DTO:

```ts
{
  success: true,
  data: {
    status: "ok",
    service: string,
    timestamp: string
  }
}
```

Processing flow:

1. Build current ISO timestamp.
2. Return health payload.

## 5.2 Player APIs

### GET `/api/v1/players`

Business purpose: list players for management and match setup.

Request DTO:

```ts
interface ListPlayersQuery {
  isActive?: boolean;
  search?: string;
  page?: number; // default 1
  pageSize?: number; // default 20, max 100
}
```

Response DTO:

```ts
ApiSuccessResponse<PlayerDto[]>;
```

Processing flow:

1. Parse query with default pagination.
2. Query players joined with group membership of current group.
3. Map `isActive` from `group_members.is_active` (membership status in current group).
4. Apply optional `isActive` and display-name `search`.
5. Return items + pagination meta.

### POST `/api/v1/players`

Business purpose: create a new player and attach to current group.

Request DTO:

```ts
interface CreatePlayerRequest {
  displayName: string; // 1..120
  slug?: string | null; // unique
  avatarUrl?: string | null; // valid URL when present
  isActive?: boolean; // default true
}
```

Response DTO:

```ts
ApiSuccessResponse<PlayerDto>;
```

Processing flow:

1. Validate body.
2. Insert into `players`.
3. Insert group membership (`group_members`) for default group with membership `isActive`.
4. Return created player.

Main errors:

- `409 PLAYER_DUPLICATE` when slug already exists.

### GET `/api/v1/players/:playerId`

Business purpose: fetch one player.

Request DTO:

```ts
interface PlayerIdParam {
  playerId: string; // uuid
}
```

Response DTO:

```ts
ApiSuccessResponse<PlayerDto>;
```

Processing flow:

1. Validate `playerId`.
2. Query player inside current group by membership (including inactive memberships).
3. Return data or not found.

Main errors:

- `404 PLAYER_NOT_FOUND`.

### PATCH `/api/v1/players/:playerId`

Business purpose: update player profile/status.

Request DTO:

```ts
interface UpdatePlayerRequest {
  displayName?: string;
  slug?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}
```

Response DTO:

```ts
ApiSuccessResponse<PlayerDto>;
```

Processing flow:

1. Require at least one field.
2. Update profile fields on `players`.
3. If `isActive` is present, update `group_members.is_active` for current group.
4. Return updated record.

Main errors:

- `400 VALIDATION_ERROR` when body is empty.
- `404 PLAYER_NOT_FOUND`.

### DELETE `/api/v1/players/:playerId`

Business purpose: soft delete player membership in current group.

Request DTO: `PlayerIdParam`.

Response DTO:

```ts
ApiSuccessResponse<{
  id: string;
  isActive: boolean;
}>;
```

Processing flow:

1. Set `group_members.is_active=false` in current group.
2. Return id + status.

Main errors:

- `404 PLAYER_NOT_FOUND`.

## 5.3 Rule APIs

### GET `/api/v1/rule-sets`

Business purpose: list rules with filtering. A rule set remains the stable identity, while business-facing config fields are taken from the latest version.

Request DTO:

```ts
interface ListRuleSetsQuery {
  module?: ModuleType;
  modules?: ModuleType[]; // supports csv or repeated query params
  status?: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;
  default?: boolean; // alias of isDefault
  search?: string; // 1..150
  from?: string; // datetime
  to?: string; // datetime
  page?: number; // default 1
  pageSize?: number; // default 20, max 100
}
```

Response DTO:

```ts
interface RuleSetDto {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

ApiSuccessResponse<RuleSetDto[]>;
```

Processing flow:

1. Parse query + paging.
2. Filter by group and optional module/modules/status/default/search/date range.
3. Return sorted by `createdAt DESC`.

### POST `/api/v1/rule-sets`

Business purpose: create one business "Rule" in a single request:

1. create rule set identity row,
2. automatically create first immutable version (`versionNo = 1`),
3. persist compiled/raw rules into that version.

Request DTO:

```ts
interface RuleInput {
  code: string;
  name: string;
  description?: string | null;
  ruleKind: RuleKind;
  priority?: number; // default 100
  status?: "ACTIVE" | "INACTIVE"; // default ACTIVE
  stopProcessingOnMatch?: boolean; // default false
  metadata?: Record<string, unknown> | null;
  conditions: Array<{
    conditionKey:
      | "participantCount"
      | "module"
      | "subjectRelativeRank"
      | "subjectAbsolutePlacement"
      | "matchContainsAbsolutePlacements";
    operator: ConditionOperator;
    valueJson: unknown;
    sortOrder?: number; // default 1
  }>;
  actions: Array<{
    actionType: "TRANSFER" | "POST_TO_FUND" | "CREATE_OBLIGATION" | "REDUCE_OBLIGATION";
    amountVnd: number;
    sourceSelectorType: SelectorType;
    sourceSelectorJson?: unknown; // default {}
    destinationSelectorType: SelectorType;
    destinationSelectorJson?: unknown; // default {}
    descriptionTemplate?: string | null;
    sortOrder?: number; // default 1
  }>;
}

interface MatchStakesPenaltyConfig {
  absolutePlacement: number; // 1..8
  amountVnd: number;
  destinationSelectorType?: MatchStakesPenaltyDestinationSelectorType; // default BEST_PARTICIPANT
  destinationSelectorJson?: Record<string, unknown> | null;
  code?: string;
  name?: string;
  description?: string | null;
}

interface MatchStakesBuilderConfig {
  participantCount: 3 | 4;
  winnerCount: number; // >= 1 and < participantCount
  payouts: Array<{ relativeRank: number; amountVnd: number }>;
  losses: Array<{ relativeRank: number; amountVnd: number }>;
  penalties?: MatchStakesPenaltyConfig[];
}

interface CreateRuleRequest {
  // root-level fields
  module: ModuleType;
  name: string; // 1..150
  status?: "ACTIVE" | "INACTIVE"; // default ACTIVE
  isDefault?: boolean; // default false

  // version-level fields
  description: string | null; // required, belongs to version
  participantCountMin: number; // 2..8
  participantCountMax: number; // 2..8
  effectiveTo?: string | null; // datetime
  isActive?: boolean; // default true
  summaryJson?: Record<string, unknown> | null;

  // Builder mode
  builderType?: RuleBuilderType | null; // currently MATCH_STAKES_PAYOUT
  builderConfig?: MatchStakesBuilderConfig | Record<string, unknown> | null;

  // Raw mode
  rules?: RuleInput[];
}
```

Important notes:

- `code` is not accepted from FE. Backend auto-generates a 6-letter uppercase code.
- Builder mode and raw mode are mutually exclusive in one request.

Response DTO:

```ts
interface RuleConditionDto {
  id?: string;
  conditionKey: string;
  operator: string;
  valueJson: unknown;
  sortOrder: number;
}

interface RuleActionDto {
  id?: string;
  actionType: string;
  amountVnd: number;
  sourceSelectorType: string;
  sourceSelectorJson: unknown;
  destinationSelectorType: string;
  destinationSelectorJson: unknown;
  descriptionTemplate: string | null;
  sortOrder: number;
}

interface RuleDto {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  ruleKind: string;
  priority: number;
  status: string;
  stopProcessingOnMatch: boolean;
  metadata: unknown;
  conditions: RuleConditionDto[];
  actions: RuleActionDto[];
}

interface RuleSetVersionDetailDto {
  id: string;
  ruleSetId: string;
  versionNo: number;
  description: string | null; // version-owned description
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown;
  builderType: string | null;
  builderConfig: unknown | null;
  createdAt: string;
  rules: RuleDto[];
}

interface RuleSetDetailDto extends RuleSetDto {
  latestVersion: RuleSetVersionDetailDto | null;
  versions: RuleSetVersionDetailDto[];
}

ApiSuccessResponse<RuleSetDetailDto>;
```

Processing flow:

1. Validate body.
2. Generate unique code (`[A-Z]{6}`) in backend.
3. If `isDefault=true`, clear existing default in same module/group.
4. Insert rule set identity row.
5. Validate builder/raw mode and business constraints.
6. Create first version with `effectiveFrom = now`.
7. Compile builder config to generic rules when in builder mode, or persist raw rules directly.
8. Return detail including `latestVersion` and full `versions`.

Main errors:

- `409 RULE_SET_DUPLICATE` (rare generated code collision).
- `409 RULE_SET_CODE_GENERATION_FAILED` when unique code could not be generated after retries.
- `400 RULE_SET_VERSION_INVALID`.
- `400 RULE_BUILDER_INVALID_CONFIG`.
- `400 RULE_BUILDER_UNSUPPORTED_MODULE`.
- `400 RULE_BUILDER_PAYOUT_LOSS_UNBALANCED`.
- `400 RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED`.
- `400 RULE_BUILDER_DUPLICATE_RANK`.
- `400 RULE_BUILDER_RANK_COVERAGE_INVALID`.

### GET `/api/v1/rule-sets/:ruleSetId`

Business purpose: rule detail for UI screens. Returns root identity + latest version + full version history.

Request DTO:

```ts
interface RuleSetIdParam {
  ruleSetId: string; // uuid
}
```

Response DTO:

```ts
ApiSuccessResponse<RuleSetDetailDto>;
```

Processing flow:

1. Load rule set by id + group.
2. Load versions sorted by `versionNo DESC`.
3. Load full detail (including rules/conditions/actions) for each version.
4. Return merged object.

Main errors:

- `404 RULE_SET_NOT_FOUND`.

### PATCH `/api/v1/rule-sets/:ruleSetId`

Business purpose: edit rule by creating a new immutable version.

This endpoint no longer behaves like a metadata-only patch.

Request DTO:

```ts
interface EditRuleRequest {
  // optional root metadata updates
  name?: string;
  status?: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;

  // required version payload (same shape as create for version part)
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveTo?: string | null;
  isActive?: boolean;
  summaryJson?: Record<string, unknown> | null;
  builderType?: RuleBuilderType | null;
  builderConfig?: MatchStakesBuilderConfig | Record<string, unknown> | null;
  rules?: RuleInput[];
}
```

Important notes:

- `module` cannot be changed (not accepted by payload).
- `code` cannot be changed (not accepted by payload).
- previous versions are never overwritten.

Response DTO: `ApiSuccessResponse<RuleSetDetailDto>`.

Processing flow:

1. Load rule set by id + group.
2. Apply optional root metadata updates (`name`, `status`, `isDefault`).
3. Create next immutable version (`versionNo = max + 1`, `effectiveFrom = now`).
4. Validate and persist builder/raw logic as in create flow.
5. Return detail where `latestVersion` is the newly created version.

Main errors:

- `404 RULE_SET_NOT_FOUND`.
- `400 RULE_SET_VERSION_INVALID`.
- `400 RULE_BUILDER_INVALID_CONFIG`.
- `400 RULE_BUILDER_UNSUPPORTED_MODULE`.
- `400 RULE_BUILDER_PAYOUT_LOSS_UNBALANCED`.
- `400 RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED`.
- `400 RULE_BUILDER_DUPLICATE_RANK`.
- `400 RULE_BUILDER_RANK_COVERAGE_INVALID`.

### Removed public version endpoints

The following APIs are no longer public in the product flow:

- `POST /api/v1/rule-sets/:ruleSetId/versions`
- `GET /api/v1/rule-sets/:ruleSetId/versions/:versionId`
- `PATCH /api/v1/rule-sets/:ruleSetId/versions/:versionId`

Versioning still exists internally for persistence/auditability, but creation/editing is now driven only through:

- `POST /api/v1/rule-sets` (create first version)
- `PATCH /api/v1/rule-sets/:ruleSetId` (create next version)

### GET `/api/v1/rule-sets/default/by-module/:module`

Business purpose: get active default rule set for quick match entry.

Request DTO:

```ts
interface DefaultByModuleParam {
  module: ModuleType;
}

interface DefaultByModuleQuery {
  participantCount?: 3 | 4;
}
```

Response DTO:

```ts
ApiSuccessResponse<{
  ruleSet: RuleSetDto;
  activeVersion: RuleSetVersionDetailDto | null;
}>;
```

Processing flow:

1. Load default rule set by module (`is_default=true`, `status=ACTIVE`).
2. If `participantCount` is provided, resolve an applicable active version at current time for that participant count.
3. If `participantCount` is omitted, return `activeVersion = null`.
4. Return both.

Main errors:

- `404 RULE_SET_DEFAULT_NOT_FOUND`.

## 5.4 Match APIs

### POST `/api/v1/matches/preview`

Business purpose: step 1 of match flow. Validate input and return calculated settlement preview without persistence.

Request DTO:

```ts
interface PreviewMatchRequest {
  module: ModuleType;
  ruleSetId: string; // uuid
  note?: string | null;
  participants: Array<{
    playerId: string; // uuid
    tftPlacement: number; // integer 1..8
  }>; // size must be 3 or 4
}
```

Response DTO:

```ts
interface PreviewMatchParticipantDto {
  playerId: string;
  playerName: string;
  tftPlacement: number;
  relativeRank: number;
  suggestedNetVnd: number;
}

interface PreviewSettlementLineDto {
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
  metadata: unknown;
}

interface PreviewSettlementDto {
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  engineVersion: string;
  ruleSnapshot: unknown;
  resultSnapshot: unknown;
  lines: PreviewSettlementLineDto[];
}

ApiSuccessResponse<{
  module: ModuleType;
  note: string | null;
  ruleSet: { id: string; name: string; module: ModuleType };
  ruleSetVersion: {
    id: string;
    versionNo: number;
    participantCountMin: number;
    participantCountMax: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  participants: PreviewMatchParticipantDto[];
  settlementPreview: PreviewSettlementDto;
}>;
```

Processing flow:

1. Validate participants:
   - count must be 3 or 4,
   - unique `playerId`,
   - unique `tftPlacement`,
   - each placement in `1..8`.
2. Verify all participants are active members of current group.
3. Load rule set and verify module matches request.
4. Resolve latest applicable active version (same rule set, effective window, participant range).
5. Build context and evaluate rule engine.
6. Return preview payload only (no match, settlement, ledger, or audit inserts).

Main errors:

- `400 MATCH_PARTICIPANT_COUNT_INVALID`
- `400 MATCH_DUPLICATE_PLAYER`
- `400 MATCH_DUPLICATE_PLACEMENT`
- `400 MATCH_PLACEMENT_INVALID`
- `404 RULE_SET_NOT_FOUND`
- `422 MATCH_PLAYERS_INVALID`
- `422 MATCH_RULE_SET_MODULE_MISMATCH`
- `422 RULE_SET_VERSION_NOT_APPLICABLE`

### POST `/api/v1/matches`

Business purpose: step 2 of match flow. Create match from either pure engine output or manually confirmed per-player net amounts.

Request DTO:

```ts
interface CreateMatchRequest {
  module: ModuleType;
  ruleSetId: string; // uuid
  ruleSetVersionId: string; // required, use preview result
  note?: string | null;
  participants: Array<{
    playerId: string; // uuid
    tftPlacement: number; // integer 1..8
  }>; // size must be 3 or 4
  confirmation?: {
    mode: "ENGINE" | "MANUAL_ADJUSTED";
    participantNets?: Array<{
      playerId: string;
      netVnd: number; // integer, can be zero
    }>;
    overrideReason?: string | null;
  };
}
```

Response DTO:

```ts
ApiSuccessResponse<{
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  status: string;
  note?: string | null;
  confirmationMode: "ENGINE" | "MANUAL_ADJUSTED";
  overrideReason: string | null;
  manualAdjusted: boolean;
  ruleSet?: { id: string; name: string; module: ModuleType };
  ruleSetVersion?: {
    id: string;
    versionNo: number;
    participantCountMin: number;
    participantCountMax: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  participants: MatchParticipantDto[];
  engineCalculationSnapshot?: unknown | null;
  settlement?: SettlementDto | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}>;
```

Processing flow:

1. Validate participants and active membership.
2. Validate rule set and module.
3. Resolve exact applicable active rule set version using `ruleSetVersionId`.
4. Evaluate engine result first (always), keep it for audit snapshot.
5. Confirmation mode:
   - `ENGINE` (default when omitted): use engine result as final result.
   - `MANUAL_ADJUSTED`: validate `participantNets`, rebuild final settlement lines deterministically from player net amounts.
6. Persist both original and final data:
   - `matches.input_snapshot_json`: request payload.
   - `matches.calculation_snapshot_json`: original engine result.
   - `match_settlements.result_snapshot_json`: final confirmed snapshot + confirmation metadata.
7. Persist final settlement lines and post ledger entries from final lines.
8. Upsert recent preset and write audit log.
9. Return match detail.

Main errors:

- `400 MATCH_PARTICIPANT_COUNT_INVALID`
- `400 MATCH_DUPLICATE_PLAYER`
- `400 MATCH_DUPLICATE_PLACEMENT`
- `400 MATCH_PLACEMENT_INVALID`
- `400 MATCH_CONFIRMATION_INVALID`
- `404 RULE_SET_NOT_FOUND`
- `422 MATCH_PLAYERS_INVALID`
- `422 MATCH_RULE_SET_MODULE_MISMATCH`
- `422 RULE_SET_VERSION_NOT_APPLICABLE`
- `400 RULE_SELECTOR_INVALID` / `400 RULE_SELECTOR_NOT_FOUND` (selector resolution)

### GET `/api/v1/matches`

Business purpose: match history list with filters.

Request DTO:

```ts
interface ListMatchesQuery {
  module?: ModuleType;
  status?: MatchStatus;
  playerId?: string;
  ruleSetId?: string;
  from?: string; // datetime
  to?: string; // datetime
  page?: number; // default 1
  pageSize?: number; // default 20, max 100
}
```

Response DTO:

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
  notePreview: string | null; // first 120 chars
  status: string;
  confirmationMode: "ENGINE" | "MANUAL_ADJUSTED";
  overrideReason: string | null;
  manualAdjusted: boolean;
  participants: MatchParticipantDto[];
  totalTransferVnd: number;
  totalFundInVnd: number;
  totalFundOutVnd: number;
  createdAt: string;
}

ApiSuccessResponse<MatchListItemDto[]>;
```

Processing flow:

1. Query match rows by filters + pagination.
2. For each match, load participants, settlement totals, rule set name, note preview.
3. Derive `confirmationMode`, `overrideReason`, and `manualAdjusted` from settlement result snapshot.
4. Return aggregated list + meta.

### GET `/api/v1/matches/:matchId`

Business purpose: detailed match audit/inspection view.

Request DTO:

```ts
interface MatchIdParam {
  matchId: string; // uuid
}
```

Response DTO:

```ts
ApiSuccessResponse<{
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  status: string;
  note: string | null;
  confirmationMode: "ENGINE" | "MANUAL_ADJUSTED";
  overrideReason: string | null;
  manualAdjusted: boolean;
  ruleSet: { id: string; name: string; module: ModuleType };
  ruleSetVersion: {
    id: string;
    versionNo: number;
    participantCountMin: number;
    participantCountMax: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  participants: MatchParticipantDto[];
  engineCalculationSnapshot: unknown | null;
  settlement: SettlementDto | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}>;
```

Processing flow:

1. Verify match exists in current group.
2. Load participants, note, settlement lines, rule set, rule version detail.
3. Include confirmation metadata and original engine snapshot for audit screens.
4. Build and return full DTO.

Main errors:

- `404 MATCH_NOT_FOUND`.

### POST `/api/v1/matches/:matchId/void`

Business purpose: accounting-safe cancellation. Keeps original ledger entries and posts reversal entries.

Request DTO:

```ts
interface VoidMatchRequest {
  reason: string; // min length 3
}
```

Response DTO:

```ts
ApiSuccessResponse<{
  id: string;
  status: "VOIDED";
  reason: string;
  voidedAt: string;
}>;
```

Processing flow:

1. Validate reason length.
2. Start DB transaction.
3. Load match and reject if missing/already voided.
4. Load original ledger entries of the match.
5. Create reversal batch (`source_type = MATCH_VOID_REVERSAL`).
6. For each original entry, swap source/destination, same amount, reason prefixed with `REVERSAL:`.
7. Insert reversal ledger entries.
8. Update match status/void reason/timestamp.
9. Insert audit log (`VOID`).
10. Return void result.

Main errors:

- `400 MATCH_VOID_REASON_INVALID`
- `404 MATCH_NOT_FOUND`
- `422 MATCH_ALREADY_VOIDED`

## 5.5 Recent Preset APIs

### GET `/api/v1/recent-match-presets/:module`

Business purpose: load last-used quick-entry setup per module.

Request DTO:

```ts
interface PresetModuleParam {
  module: ModuleType;
}
```

Response DTO:

```ts
interface RecentPresetDto {
  module: ModuleType;
  lastRuleSetId: string | null;
  lastRuleSetVersionId: string | null;
  lastSelectedPlayerIds: string[];
  lastParticipantCount: number | null;
  lastUsedAt: string | null;
}

ApiSuccessResponse<RecentPresetDto>;
```

Processing flow:

1. Query `recent_match_presets` by group + module.
2. If not found, return default empty preset payload.

### PUT `/api/v1/recent-match-presets/:module`

Business purpose: save/update quick-entry preset.

Request DTO:

```ts
interface UpsertPresetRequest {
  lastRuleSetId?: string | null;
  lastRuleSetVersionId?: string | null;
  lastSelectedPlayerIds?: string[]; // default []
  lastParticipantCount: number; // 3..4
}
```

Response DTO: `ApiSuccessResponse<RecentPresetDto>`.

Processing flow:

1. Validate body.
2. Upsert by unique key `(group_id, module)`.
3. Return latest preset.

## 5.6 Match Stakes APIs

### GET `/api/v1/match-stakes/summary`

Business purpose: module-level standings and aggregate metrics.

Request DTO:

```ts
interface ModuleSummaryQuery {
  from?: string; // datetime
  to?: string; // datetime
}
```

Response DTO:

```ts
ApiSuccessResponse<{
  module: "MATCH_STAKES";
  players: Array<{
    playerId: string;
    playerName: string;
    totalNetVnd: number;
    totalMatches: number;
    firstPlaceCountAmongParticipants: number;
    biggestLossCount: number;
  }>;
  debtSuggestions: unknown[]; // current implementation returns []
  totalMatches: number;
  range: { from: string | null; to: string | null };
}>;
```

Processing flow:

1. Aggregate player net/stats from ledger + match tables.
2. Count total matches for module.
3. Return summary and range echo.

### GET `/api/v1/match-stakes/ledger`

Business purpose: list ledger movements for Match Stakes.

Request DTO:

```ts
interface ModuleLedgerQuery {
  playerId?: string;
  from?: string;
  to?: string;
  page?: number; // default 1
  pageSize?: number; // default 20, max 100
}
```

Response DTO:

```ts
ApiSuccessResponse<Array<{
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
}>>;
```

Processing flow:

1. Query ledger entries by group/module with optional player/date filters.
2. Join account/player/rule metadata.
3. Map DB snake_case to API camelCase.
4. Return items + pagination meta.

### GET `/api/v1/match-stakes/matches`

Business purpose: match history restricted to module `MATCH_STAKES`.

Request DTO:

```ts
interface ModuleMatchesQuery extends ModuleLedgerQuery {
  ruleSetId?: string;
}
```

Response DTO: `ApiSuccessResponse<MatchListItemDto[]>`.

Processing flow:

1. Force `module = MATCH_STAKES`.
2. Delegate to common match list service.
3. Return paginated list.

## 5.7 Group Fund APIs

### GET `/api/v1/group-fund/summary`

Business purpose: fund health overview and player obligations/contributions.

Request DTO: `ModuleSummaryQuery`.

Response DTO:

```ts
ApiSuccessResponse<{
  module: "GROUP_FUND";
  fundBalanceVnd: number;
  totalMatches: number;
  players: Array<{
    playerId: string;
    playerName: string;
    totalContributedVnd: number;
    currentObligationVnd: number;
  }>;
  range: { from: string | null; to: string | null };
}>;
```

Processing flow:

1. Compute `fundBalanceVnd` from ledger movements in/out of `FUND_MAIN`.
2. Compute per-player contribution and current obligation.
3. Count module matches.
4. Return summary.

### POST `/api/v1/group-fund/transactions`

Business purpose: create manual Group Fund transactions outside match settlement.

Request DTO:

```ts
interface CreateGroupFundTransactionRequest {
  transactionType: "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  playerId?: string | null; // required for CONTRIBUTION and WITHDRAWAL
  amountVnd: number; // positive integer
  reason: string; // min length 3
  postedAt?: string; // optional ISO datetime
}
```

Response DTO:

```ts
ApiSuccessResponse<{
  batchId: string;
  postedAt: string;
  sourceType: "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION";
  transactionType: "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  playerId: string | null;
  playerName: string | null;
  amountVnd: number;
  reason: string;
}>;
```

Processing flow:

1. Validate payload and transaction/player constraints.
2. Resolve fund/player/system ledger accounts.
3. Create ledger batch (`GROUP_FUND`, source type `MANUAL_ADJUSTMENT` or `SYSTEM_CORRECTION`).
4. Insert one ledger entry with requested amount and reason.
5. Return created transaction payload.

### GET `/api/v1/group-fund/transactions`

Business purpose: list manual Group Fund transactions.

Request DTO:

```ts
interface ListGroupFundTransactionsQuery {
  transactionType?: "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  playerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
```

Response DTO:

```ts
ApiSuccessResponse<Array<{
  entryId: string;
  batchId: string;
  postedAt: string;
  sourceType: "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION";
  transactionType: "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  playerId: string | null;
  playerName: string | null;
  amountVnd: number;
  reason: string;
}>>;
```

### GET `/api/v1/group-fund/ledger`

Business purpose: list fund increase/decrease movements.

Request DTO: `ModuleLedgerQuery`.

Response DTO:

```ts
ApiSuccessResponse<Array<{
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
}>>;
```

Processing flow:

1. Query module ledger entries.
2. Derive movement direction by account types:
   - `FUND_IN` when destination is fund/main incoming pattern.
   - `FUND_OUT` otherwise.
3. Select related player based on direction.
4. Return mapped rows + pagination meta.

### GET `/api/v1/group-fund/matches`

Business purpose: match history restricted to module `GROUP_FUND`.

Request DTO: `ModuleMatchesQuery`.

Response DTO: `ApiSuccessResponse<MatchListItemDto[]>`.

Processing flow:

1. Force `module = GROUP_FUND`.
2. Delegate to common match list service.
3. Return paginated list.

## 5.8 Dashboard API

### GET `/api/v1/dashboard/overview`

Business purpose: one-call overview for home/dashboard screens.

Request DTO: none.

Response DTO:

```ts
ApiSuccessResponse<{
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
}>;
```

Processing flow:

1. Run 7 service calls in parallel:
   - player count,
   - total match count,
   - Match Stakes summary,
   - Match Stakes match count,
   - Group Fund summary,
   - Group Fund match count,
   - latest 5 matches.
2. Compute top 5 Match Stakes players by `totalNetVnd`.
3. Compute top 5 Group Fund contributors by `totalContributedVnd`.
4. Return combined overview.

## 6. Core Business Logic Notes

### 6.1 Rule engine behavior used by preview and match creation

1. Rules are sorted by priority ascending.
2. Inactive rules are skipped.
3. Subject-scoped conditions (`subjectRelativeRank`, `subjectAbsolutePlacement`) run rule evaluation per participant.
4. Conditions are evaluated with operators: `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `IN`, `NOT_IN`, `BETWEEN`, `CONTAINS`.
5. Each action resolves source and destination accounts via selector type.
6. Same source/destination account pair is ignored.
7. Settlement summary is computed:
   - `totalTransferVnd`,
   - `totalFundInVnd` (destination is non-player),
   - `totalFundOutVnd` (source is non-player),
   - `netByPlayer`.

### 6.2 Account selector resolution

- `SUBJECT_PLAYER`: current participant.
- `PLAYER_BY_RELATIVE_RANK`: participant by rank among match participants.
- `PLAYER_BY_ABSOLUTE_PLACEMENT`: participant by TFT placement.
- `MATCH_WINNER` / `BEST_PARTICIPANT`: rank 1 participant.
- `MATCH_RUNNER_UP`: rank 2 participant.
- `WORST_PARTICIPANT`: participant with worst relative rank.
- `FUND_ACCOUNT`: group fund account.
- `SYSTEM_ACCOUNT`: system holding account.
- `FIXED_PLAYER`: explicit player id from selector json.

### 6.3 Match Stakes builder compile behavior

- Builder type `MATCH_STAKES_PAYOUT` compiles to generic `TRANSFER` rules.
- Base payout/loss compile strategy is deterministic:
  - losers are processed by ascending relative rank,
  - each loser amount is allocated to winners in ascending winner rank until fully allocated.
- Generated base rule codes use stable format:
  - `BASE_LOSS_RANK_<FROM>_TO_WINNER` (single-winner case),
  - `BASE_LOSS_RANK_<FROM>_TO_RANK_<TO>` (multi-winner case).
- Penalties compile to subject-scoped rules with stable codes:
  - `PENALTY_ABSOLUTE_PLACEMENT_<placement>`.
- Default penalty destination is `BEST_PARTICIPANT` when omitted.
- Existing settlement behavior remains unchanged:
  - if source and destination resolve to the same account, the line is skipped.

### 6.4 Accounting safety for void

- Original ledger entries are never deleted.
- Void creates a dedicated reversal batch and opposite ledger entries.
- Match is marked `VOIDED` with reason and timestamp.

## 7. Error Code Reference (Observed in Source)

| Code | Meaning |
| --- | --- |
| `VALIDATION_ERROR` | Zod validation failed |
| `INTERNAL_ERROR` | Unhandled server error |
| `GROUP_NOT_FOUND` | Default group code not found at startup |
| `PLAYER_DUPLICATE` | Player slug conflict |
| `PLAYER_NOT_FOUND` | Player not found in active group membership |
| `RULE_SET_DUPLICATE` | Rule set code conflict in group (rare generated code collision) |
| `RULE_SET_CODE_GENERATION_FAILED` | Could not generate a unique rule code after retries |
| `RULE_SET_NOT_FOUND` | Rule set id not found |
| `RULE_SET_VERSION_INVALID` | Invalid version payload (participant range/rules requirement) |
| `RULE_VERSION_NOT_FOUND` | Created version could not be reloaded (unexpected consistency error) |
| `RULE_SET_DEFAULT_NOT_FOUND` | No active default rule set for module |
| `RULE_BUILDER_UNSUPPORTED_MODULE` | Builder used outside supported module |
| `RULE_BUILDER_INVALID_CONFIG` | Builder config invalid or mixed mode payload |
| `RULE_BUILDER_PAYOUT_LOSS_UNBALANCED` | Builder base payouts/losses not balanced |
| `RULE_BUILDER_PARTICIPANT_COUNT_UNSUPPORTED` | Builder participant count not supported |
| `RULE_BUILDER_DUPLICATE_RANK` | Duplicate rank in payouts or losses |
| `RULE_BUILDER_RANK_COVERAGE_INVALID` | Payout/loss ranks do not fully cover participant ranks |
| `MATCH_PARTICIPANT_COUNT_INVALID` | Participants not 3/4 |
| `MATCH_DUPLICATE_PLAYER` | Duplicate player ids in one match |
| `MATCH_DUPLICATE_PLACEMENT` | Duplicate TFT placements in one match |
| `MATCH_PLACEMENT_INVALID` | Placement out of range or non-integer |
| `MATCH_CONFIRMATION_INVALID` | Manual confirmation payload (participant nets/mode) is invalid |
| `MATCH_PLAYERS_INVALID` | Participant inactive or outside group |
| `MATCH_RULE_SET_MODULE_MISMATCH` | Rule set module mismatch |
| `RULE_SET_VERSION_NOT_APPLICABLE` | No active version for participant/time |
| `MATCH_NOT_FOUND` | Match not found |
| `MATCH_VOID_REASON_INVALID` | Void reason shorter than 3 chars |
| `MATCH_ALREADY_VOIDED` | Match already voided |
| `RULE_SELECTOR_INVALID` | Selector type/json invalid |
| `RULE_SELECTOR_NOT_FOUND` | Selector target participant not found |
