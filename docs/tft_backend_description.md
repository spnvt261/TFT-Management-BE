# Mô tả Backend hệ thống quản lý lịch sử LolChess TFT

## 1. Mục tiêu backend

Backend của hệ thống cần đáp ứng đầy đủ các nghiệp vụ được mô tả trong tài liệu yêu cầu gốc: quản lý lịch sử trận TFT cho một nhóm bạn, hỗ trợ hai luồng kế toán độc lập là **Match Stakes** và **Group Fund**, đồng thời cho phép cấu hình luật linh hoạt thay vì hard-code rải rác trong code. Các yêu cầu cốt lõi gồm:

- lưu trữ lâu dài toàn bộ lịch sử trận, người chơi, luật, bút toán và kết quả tính toán
- tính settlement ngay khi tạo trận
- lưu vết chi tiết từng dòng tính toán để audit về sau
- hỗ trợ chỉnh sửa giá trị luật mà không phải sửa logic lõi
- tách biệt rõ domain logic với API/controller và data layer
- tối ưu cho side project nhỏ, chi phí thấp, dễ deploy, nhưng vẫn đủ nền tảng để mở rộng

Tài liệu này được xây dựng từ mô tả nghiệp vụ chi tiết mà bạn đã cung cấp trong OpenSpec prompt fileciteturn0file0.

---

## 2. Kiến trúc backend được đề xuất

### 2.1 Lựa chọn kiến trúc

**Chọn Option A**:

- `apps/web`: React + Vite
- `apps/api`: TypeScript API dạng serverless/Vercel Functions
- `packages/shared`: shared types, schema validation, domain contracts
- `packages/domain`: business logic, calculation engine, use cases
- `packages/db`: Drizzle schema, migrations, seed, repository helpers

### 2.2 Lý do chọn Option A

Option A phù hợp hơn vì:

1. **Tách lớp rõ ràng**: frontend, API, domain, DB độc lập, dễ bảo trì.
2. **Dễ mở rộng**: sau này có thể thay frontend, thêm admin UI, cron, webhook mà không phá vỡ domain.
3. **Hợp với rule engine**: logic tính toán phức tạp nên cần package domain riêng, tránh nhét chung trong web app.
4. **Vẫn thân thiện free-tier**: API serverless trên Vercel đủ cho side project nhỏ.
5. **Dễ test**: calculation engine có thể unit test độc lập mà không cần khởi động web.

### 2.3 Cấu trúc lớp backend

```text
apps/api
  ├─ routes/                # endpoint definitions
  ├─ handlers/              # parse request, auth stub, response mapping
  └─ presenters/            # DTO mapping

packages/domain
  ├─ entities/              # Player, Match, RuleSet...
  ├─ services/              # calculation engine, summaries
  ├─ use-cases/             # create-match, get-fund-summary...
  ├─ rules/                 # rule evaluators
  └─ ledger/                # ledger posting + balance logic

packages/db
  ├─ schema/                # drizzle schema
  ├─ migrations/
  ├─ seeds/
  └─ repositories/

packages/shared
  ├─ schemas/               # zod request/response schemas
  ├─ constants/
  ├─ enums/
  └─ utils/
```

### 2.4 Nguyên tắc thiết kế

- API layer chỉ nhận request, validate, gọi use-case, trả response.
- Domain layer là nơi duy nhất hiểu luật nghiệp vụ.
- DB/repository layer chỉ lo persistence.
- Mọi giá trị tiền tệ đều là **integer VND**, không dùng float.
- Mọi thời gian đều lưu UTC, trả ra kèm timezone rõ ràng khi cần hiển thị.

---

## 3. Backend tech stack

### 3.1 Ngôn ngữ và framework

- **TypeScript** cho toàn bộ backend
- **Node.js** runtime
- **Vercel Functions** hoặc API adapter tương thích Vercel
- Có thể dùng **Hono** hoặc **Express-style thin router** cho API; với side project này, Hono là lựa chọn gọn, typed tốt, hợp serverless

### 3.2 Database và truy cập dữ liệu

- **PostgreSQL**
- **Drizzle ORM** cho type-safe schema và query
- **Drizzle Kit** cho migration
- **Neon** hoặc **Supabase Postgres** cho free-tier / near-free-tier

### 3.3 Validation và test

- **Zod** cho validation request/response/input domain
- **Vitest** cho unit test calculation engine và use case
- Có thể thêm **supertest** hoặc test integration mức API nếu cần

### 3.4 Khuyến nghị triển khai

- Frontend deploy trên Vercel
- API deploy cùng Vercel project hoặc project riêng
- Database dùng Neon Postgres
- Secrets quản lý qua Vercel environment variables

---

## 4. Phân tách 2 luồng kế toán

Đây là điểm rất quan trọng của backend.

### 4.1 Match Stakes

Luồng này phản ánh **tiền chơi trực tiếp giữa người chơi với nhau**.

Đặc tính:
- có winner/loser theo rule set
- settlement line chủ yếu là **player -> player**
- cần tổng hợp **lãi/lỗ ròng theo người chơi**
- cần hiển thị **overall group debt state**
- penalty có thể cấu hình source/destination riêng

### 4.2 Group Fund

Luồng này phản ánh **tiền vào/ra quỹ nhóm**.

Đặc tính:
- không có direct winner mặc định
- settlement line chủ yếu là **player -> fund** hoặc **fund -> player**
- cần tính **fund balance hiện tại**
- cần tính **mỗi người đã đóng bao nhiêu** và **đang nợ quỹ bao nhiêu**

### 4.3 Cách tách trong backend

Không chỉ tách bằng cờ `module`, mà còn tách ở 3 tầng:

1. **RuleSet applicability**
   - mỗi rule set chỉ áp dụng cho `MATCH_STAKES` hoặc `GROUP_FUND`
2. **Settlement account model**
   - source và destination account được mô hình hóa rõ: `PLAYER`, `FUND`, có thể mở rộng `INTERMEDIATE`, `SYSTEM`
3. **Ledger posting strategy**
   - Match Stakes post vào `player_ledger`
   - Group Fund post vào `fund_ledger` và record receivable theo player

Nhờ đó, dù cả hai cùng dùng engine chung, phần accounting vẫn tách bạch.

---

## 5. Mô hình domain backend

## 5.1 Aggregate và entity chính

### Group
Đại diện một nhóm bạn chơi TFT.

### Player
Người chơi thuộc group.

### Match
Một trận được tạo trong hệ thống. Mỗi match thuộc đúng một module.

### MatchParticipant
Thông tin từng người tham gia trận, bao gồm thứ hạng TFT tuyệt đối 1..8 và thứ hạng tương đối trong nhóm tham gia.

### MatchNote
Ghi chú của trận. Có thể tách bảng riêng hoặc cột trực tiếp trong `matches`. Với MVP, dùng cột `note` trong `matches` là đủ.

### RuleSet
Tập luật được chọn khi tạo trận.

### Rule
Một luật con trong rule set, ví dụ base payout hoặc modifier top8 penalty.

### RuleCondition
Điều kiện kích hoạt rule.

### RuleAction
Hành động settlement khi điều kiện đúng.

### MatchSettlement
Kết quả tính toán của một match tại thời điểm lưu.

### MatchSettlementLine
Từng dòng chuyển tiền/ghi nhận kế toán do một rule sinh ra.

### PlayerLedger
Sổ cái luồng Match Stakes.

### FundLedger
Sổ cái luồng Group Fund.

### RecentMatchPreset
Preset lần nhập gần nhất để tăng tốc UX.

### AuditLog
Lưu hành động quan trọng: tạo trận, sửa rule, deactivate player...

---

## 6. Thiết kế cơ sở dữ liệu backend

Dưới đây là thiết kế thực dụng cho MVP nhưng vẫn mở rộng tốt.

## 6.1 Bảng `groups`

Mục đích: quản lý một hoặc nhiều nhóm chơi.

Các cột:
- `id` UUID PK
- `name` varchar not null
- `code` varchar unique nullable
- `is_active` boolean default true
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

## 6.2 Bảng `players`

Mục đích: lưu người chơi.

Các cột:
- `id` UUID PK
- `group_id` UUID FK -> groups.id
- `display_name` varchar not null
- `short_name` varchar nullable
- `avatar_url` varchar nullable
- `is_active` boolean default true
- `sort_order` int default 0
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Chỉ mục:
- `(group_id, is_active)`
- unique `(group_id, display_name)` nếu muốn tránh trùng tên

## 6.3 Bảng `rule_sets`

Mục đích: tập luật áp dụng khi tạo match.

Các cột:
- `id` UUID PK
- `group_id` UUID FK -> groups.id
- `name` varchar not null
- `module_type` enum: `MATCH_STAKES` | `GROUP_FUND`
- `participant_count` smallint not null
- `version` int not null default 1
- `is_active` boolean default true
- `effective_from` timestamptz nullable
- `effective_to` timestamptz nullable
- `description` text nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Chỉ mục:
- `(group_id, module_type, participant_count, is_active)`

## 6.4 Bảng `rules`

Mục đích: từng luật thành phần trong rule set.

Các cột:
- `id` UUID PK
- `rule_set_id` UUID FK -> rule_sets.id
- `code` varchar not null
- `name` varchar not null
- `rule_type` enum: `BASE_PLACEMENT`, `ABSOLUTE_PLACEMENT_MODIFIER`, `CUSTOM_FORMULA`
- `priority` int not null default 100
- `is_active` boolean default true
- `stop_processing` boolean default false
- `config_json` jsonb not null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

`config_json` chứa cấu hình có schema ổn định theo `rule_type`.

Ví dụ:
- base payout 3 người: rank1 +100000, rank2 -50000, rank3 -50000
- top8 penalty: when absolutePlacement=8, from=subject player, to=bestParticipant, amount=10000

## 6.5 Bảng `matches`

Mục đích: thực thể trung tâm của hệ thống.

Các cột:
- `id` UUID PK
- `group_id` UUID FK -> groups.id
- `module_type` enum: `MATCH_STAKES` | `GROUP_FUND`
- `rule_set_id` UUID FK -> rule_sets.id
- `played_at` timestamptz not null
- `participant_count` smallint not null
- `note` text nullable
- `status` enum: `CALCULATED` | `VOIDED`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Ràng buộc:
- `participant_count in (3,4)` cho MVP

## 6.6 Bảng `match_participants`

Mục đích: lưu các người chơi tham gia và placement.

Các cột:
- `id` UUID PK
- `match_id` UUID FK -> matches.id
- `player_id` UUID FK -> players.id
- `tft_placement` smallint not null
- `relative_rank` smallint not null
- `is_winner_flag` boolean default false
- `created_at` timestamptz not null

Ràng buộc:
- `tft_placement between 1 and 8`
- unique `(match_id, player_id)`
- unique `(match_id, tft_placement)` để tránh placement trùng trong cùng trận

`relative_rank` được tính khi tạo trận, là thứ hạng trong số người tham gia.

## 6.7 Bảng `match_rule_snapshots`

Mục đích: lưu snapshot rule set tại thời điểm tính match, tránh việc sửa rule sau này làm sai lịch sử.

Các cột:
- `id` UUID PK
- `match_id` UUID FK -> matches.id unique
- `rule_set_id` UUID FK -> rule_sets.id
- `rule_set_name` varchar not null
- `module_type` enum not null
- `participant_count` smallint not null
- `snapshot_json` jsonb not null
- `created_at` timestamptz not null

## 6.8 Bảng `match_settlements`

Mục đích: kết quả settlement cấp match.

Các cột:
- `id` UUID PK
- `match_id` UUID FK -> matches.id unique
- `module_type` enum not null
- `currency` varchar not null default 'VND'
- `total_inflow` bigint not null default 0
- `total_outflow` bigint not null default 0
- `summary_json` jsonb not null
- `created_at` timestamptz not null

`summary_json` có thể chứa:
- net_by_player
- total_to_fund
- total_from_fund
- applied_rules

## 6.9 Bảng `match_settlement_lines`

Mục đích: bảng quan trọng nhất để audit.

Các cột:
- `id` UUID PK
- `match_settlement_id` UUID FK -> match_settlements.id
- `match_id` UUID FK -> matches.id
- `rule_id` UUID nullable FK -> rules.id
- `rule_code` varchar not null
- `line_type` enum: `TRANSFER`, `FUND_CONTRIBUTION`, `FUND_PAYOUT`, `ADJUSTMENT`
- `source_account_type` enum: `PLAYER`, `FUND`, `SYSTEM`
- `source_player_id` UUID nullable FK -> players.id
- `destination_account_type` enum: `PLAYER`, `FUND`, `SYSTEM`
- `destination_player_id` UUID nullable FK -> players.id
- `amount` bigint not null
- `reason_text` text not null
- `meta_json` jsonb nullable
- `created_at` timestamptz not null

Ví dụ:
- A trả B 100000 vì base settlement
- C trả A 10000 vì top8 penalty
- D đóng quỹ 20000 vì fund contribution

## 6.10 Bảng `player_ledger`

Mục đích: sổ cái truy vấn nhanh cho Match Stakes.

Các cột:
- `id` UUID PK
- `group_id` UUID FK -> groups.id
- `match_id` UUID nullable FK -> matches.id
- `settlement_line_id` UUID nullable FK -> match_settlement_lines.id
- `player_id` UUID FK -> players.id
- `entry_type` enum: `CREDIT`, `DEBIT`
- `amount` bigint not null
- `balance_effect` bigint not null
- `reason_text` text not null
- `occurred_at` timestamptz not null
- `created_at` timestamptz not null

Quy ước:
- credit = player nhận tiền
- debit = player trả tiền
- `balance_effect`: số signed để tổng hợp nhanh, ví dụ +100000, -50000

Mỗi transfer player->player thường sinh **2 ledger entries**:
- payer: -amount
- receiver: +amount

## 6.11 Bảng `fund_ledger`

Mục đích: sổ cái quỹ.

Các cột:
- `id` UUID PK
- `group_id` UUID FK -> groups.id
- `match_id` UUID nullable FK -> matches.id
- `settlement_line_id` UUID nullable FK -> match_settlement_lines.id
- `related_player_id` UUID nullable FK -> players.id
- `entry_type` enum: `INFLOW`, `OUTFLOW`, `RECEIVABLE_INCREASE`, `RECEIVABLE_DECREASE`
- `amount` bigint not null
- `balance_effect` bigint not null
- `player_receivable_effect` bigint not null default 0
- `reason_text` text not null
- `occurred_at` timestamptz not null
- `created_at` timestamptz not null

Ý nghĩa:
- quỹ nhận tiền: `INFLOW`, balance_effect dương
- quỹ trả tiền: `OUTFLOW`, balance_effect âm
- người chơi phát sinh nợ quỹ: receivable tăng
- người chơi trả nợ quỹ: receivable giảm

## 6.12 Bảng `recent_match_presets`

Mục đích: nhớ lần nhập gần nhất để tăng tốc UX.

Các cột:
- `id` UUID PK
- `group_id` UUID FK -> groups.id
- `scope_type` enum: `GROUP`, `USER`
- `scope_key` varchar not null
- `last_module_type` enum nullable
- `last_rule_set_id` UUID nullable FK -> rule_sets.id
- `last_player_ids_json` jsonb not null
- `last_played_at` timestamptz nullable
- `updated_at` timestamptz not null

Với MVP chưa có auth, có thể dùng 1 preset cấp group.

## 6.13 Bảng `audit_logs`

Các cột:
- `id` UUID PK
- `entity_type` varchar not null
- `entity_id` UUID not null
- `action` varchar not null
- `payload_json` jsonb not null
- `created_at` timestamptz not null

---

## 7. Tư duy rule engine

Mục tiêu là **không hard-code if/else rải rác**. Rule engine nên hoạt động theo pipeline.

## 7.1 Input của engine

Engine nhận:
- `moduleType`
- `participantCount`
- danh sách participant với `playerId`, `tftPlacement`
- `ruleSetSnapshot`
- metadata: matchId, groupId, playedAt

## 7.2 Bước chuẩn hóa trước khi evaluate

1. validate số participant
2. validate placement unique
3. sort theo `tftPlacement` tăng dần
4. gán `relativeRank`
5. tạo context:
   - best participant
   - worst participant
   - ai đạt absolute placement 1, 2, 8
   - map player by id

## 7.3 Rule evaluator pipeline

```text
CreateMatchUseCase
  -> load rule set
  -> snapshot rule set
  -> build match context
  -> evaluate active rules by priority
  -> generate settlement lines
  -> validate accounting invariants
  -> persist match + settlement + ledgers
```

## 7.4 Các loại rule tối thiểu

### A. Base placement rule
Dựa trên `relative_rank` trong số người tham gia.

Ví dụ Match Stakes 3 người:
- relative_rank 1 => receive 100000
- relative_rank 2 => pay 50000
- relative_rank 3 => pay 50000

Ví dụ Group Fund 3 người:
- relative_rank 2 => pay X to fund
- relative_rank 3 => pay Y to fund

### B. Absolute placement modifier rule
Dựa trên `tft_placement` thực tế 1..8.

Ví dụ:
- top8 penalty
- top1-top2 special penalty

### C. Custom rule hook
Để mở rộng sau này cho luật phức tạp hơn, nhưng MVP chỉ cần interface, chưa cần full visual builder.

## 7.5 Mô hình condition/action

Mỗi rule có thể biểu diễn bởi config kiểu:

```json
{
  "conditions": [
    { "fact": "participantCount", "operator": "=", "value": 3 },
    { "fact": "absolutePlacement", "operator": "=", "value": 8 }
  ],
  "actions": [
    {
      "type": "TRANSFER",
      "amount": 10000,
      "source": { "kind": "SUBJECT_PLAYER" },
      "destination": { "kind": "BEST_PARTICIPANT" }
    }
  ]
}
```

Nhờ đó source/destination không bị đóng cứng.

## 7.6 Nơi tiền penalty đi về đâu

Do yêu cầu gốc chưa chốt hoàn toàn, backend phải cho phép rule chỉ rõ source/destination. Với MVP dùng default assumption:

- `top1-top2 penalty`: top 2 trả 10,000 cho top 1
- `top8 penalty`: top 8 trả 10,000 cho người có placement tốt nhất trong nhóm tham gia

Nhưng config vẫn phải hỗ trợ destination là:
- winner
- fund
- account khác

## 7.7 Bất biến kế toán cần check

### Với Match Stakes
- tổng credit = tổng debit trong match settlement
- không có tiền tự sinh ra hoặc mất đi

### Với Group Fund
- inflow/outflow phải khớp với settlement lines
- nếu dùng receivable logic thì receivable summary theo player phải khớp fund ledger

---

## 8. Luồng tạo match trong backend

## 8.1 Request tạo match

Input:
- `groupId`
- `moduleType`
- `ruleSetId`
- `playedAt`
- `participants[]` gồm `playerId`, `tftPlacement`
- `note`

## 8.2 Validation

- rule set phải active
- rule set phải cùng module với match
- participant count phải khớp rule set
- player phải thuộc group và active
- không trùng player
- placement duy nhất trong match
- placement trong khoảng 1..8

## 8.3 Use case flow

1. start transaction
2. insert `matches`
3. insert `match_participants`
4. snapshot rule set vào `match_rule_snapshots`
5. chạy calculation engine
6. insert `match_settlements`
7. insert `match_settlement_lines`
8. post vào `player_ledger` hoặc `fund_ledger`
9. update `recent_match_presets`
10. ghi `audit_logs`
11. commit

Nếu bất kỳ bước nào fail thì rollback toàn bộ.

---

## 9. API backend đề xuất

Dưới đây là API theo nhu cầu MVP.

## 9.1 Player APIs

### `GET /api/players`
Lấy danh sách player theo group.

Query:
- `groupId`
- `activeOnly=true|false`

### `POST /api/players`
Tạo player mới.

### `PATCH /api/players/:id`
Sửa tên, trạng thái active/inactive.

### `DELETE /api/players/:id`
Soft delete hoặc deactivate.

Khuyến nghị: dùng soft delete qua `is_active=false`.

---

## 9.2 Rule APIs

### `GET /api/rule-sets`
Lấy danh sách rule set, filter theo module, participant count, active.

### `GET /api/rule-sets/:id`
Lấy chi tiết rule set + rules.

### `POST /api/rule-sets`
Tạo rule set.

### `PATCH /api/rule-sets/:id`
Cập nhật metadata rule set.

### `POST /api/rule-sets/:id/rules`
Thêm rule vào rule set.

### `PATCH /api/rules/:id`
Sửa config rule.

### `POST /api/rule-sets/:id/activate`
Kích hoạt rule set.

### `POST /api/rule-sets/:id/deactivate`
Vô hiệu hóa rule set.

---

## 9.3 Match APIs

### `POST /api/matches`
Tạo match và tính settlement ngay.

Response nên trả:
- match info
- participants
- settlement summary
- breakdown theo rule

### `GET /api/matches`
Danh sách match.

Filter:
- `groupId`
- `moduleType`
- `playerId`
- `ruleSetId`
- `from`
- `to`
- `page`
- `pageSize`

### `GET /api/matches/:id`
Chi tiết trận, gồm:
- participants
- note
- rule snapshot
- settlement lines
- net by player

### `POST /api/matches/:id/void`
Void match nếu cần sửa lịch sử sau này.

Với MVP có thể chưa mở UI nhưng backend nên chừa hướng này.

---

## 9.4 Summary APIs cho Match Stakes

### `GET /api/match-stakes/summary`
Trả:
- total won/lost per player
- total matches
- first-place-among-participants count
- biggest-loss count
- optional time filters

### `GET /api/match-stakes/ledger`
Debt movement history.

### `GET /api/match-stakes/debts`
Trả net balance theo player và có thể thêm gợi ý simplification “ai trả ai”.

**Lưu ý**: “gợi ý ai trả ai” là lớp service tổng hợp từ net balances, không phải dữ liệu gốc ledger.

---

## 9.5 Summary APIs cho Group Fund

### `GET /api/group-fund/summary`
Trả:
- current fund balance
- total contributed by player
- amount owed to fund by player
- total matches

### `GET /api/group-fund/ledger`
Fund increase/decrease history.

### `GET /api/group-fund/matches`
History match thuộc module Group Fund.

---

## 9.6 Recent preset APIs

### `GET /api/match-presets/latest`
Lấy preset gần nhất cho form tạo match.

### `PUT /api/match-presets/latest`
Cập nhật preset gần nhất.

Thực tế endpoint PUT có thể không cần nếu backend tự update sau khi tạo match thành công.

---

## 10. Query và báo cáo quan trọng

## 10.1 Tổng lãi/lỗ theo player

Nguồn dữ liệu: `player_ledger`

Công thức:
```sql
sum(balance_effect) group by player_id
```

## 10.2 Fund balance hiện tại

Nguồn dữ liệu: `fund_ledger`

Công thức:
```sql
sum(balance_effect)
```

## 10.3 Player owes fund bao nhiêu

Nguồn dữ liệu: `fund_ledger`

Công thức:
```sql
sum(player_receivable_effect) group by related_player_id
```

## 10.4 Match detail breakdown

Nguồn dữ liệu chính:
- `matches`
- `match_participants`
- `match_rule_snapshots`
- `match_settlement_lines`

Đây là lý do bắt buộc phải lưu settlement lines và snapshot.

---

## 11. Cơ chế recent preset để cải thiện UX

Yêu cầu gốc nhấn mạnh việc nhớ lần nhập gần nhất để tăng tốc nhập liệu trên mobile fileciteturn0file0.

### 11.1 Dữ liệu cần nhớ

- module lần trước
- rule set lần trước
- danh sách player lần trước
- thời gian chơi gần nhất nếu muốn prefill

### 11.2 Cách backend hỗ trợ

Sau mỗi lần tạo match thành công:
- update `recent_match_presets`

Khi mở form tạo match:
- frontend gọi `GET /api/match-presets/latest`
- backend trả preset để prefill form

### 11.3 Phạm vi preset

MVP có thể dùng 1 preset cho cả group.
Sau này nếu có auth thì nâng cấp thành preset theo user.

---

## 12. Timezone và tiền tệ

## 12.1 Timezone

Backend phải explicit timezone handling:

- lưu `played_at`, `created_at`, `updated_at` bằng `timestamptz`
- chuẩn hóa lưu UTC
- frontend gửi ISO timestamp rõ timezone
- khi query theo ngày, backend phải cẩn thận convert theo timezone hiển thị, ví dụ `Asia/Bangkok` hoặc `Asia/Ho_Chi_Minh`

### Khuyến nghị

- DB session timezone: UTC
- app layer mới xử lý hiển thị local timezone

## 12.2 Tiền tệ

- lưu bằng `bigint` hoặc integer đủ lớn
- đơn vị mặc định: VND
- không dùng decimal/float cho settlement logic

---

## 13. Migration, seed và test

## 13.1 Migration

Cần có migration rõ ràng cho toàn bộ schema.

Khuyến nghị thứ tự migration:
1. groups, players
2. rule_sets, rules
3. matches, match_participants
4. match_rule_snapshots, match_settlements, match_settlement_lines
5. player_ledger, fund_ledger
6. recent_match_presets, audit_logs

## 13.2 Seed data

Seed tối thiểu:
- 1 group demo
- 4 players demo
- 1 rule set Match Stakes cho 3 players
- 1 rule set Match Stakes cho 4 players
- 1 rule set Group Fund cho 3 players
- vài match mẫu để test dashboard

## 13.3 Test cần có

### Unit test cho rule engine
- Match Stakes 3 players
- Match Stakes 4 players
- top1-top2 penalty
- top8 penalty
- Group Fund 3 players
- multiple rules áp dụng cùng lúc

### Integration test cho create match
- tạo match thành công sẽ persist:
  - match
  - participants
  - snapshot
  - settlement
  - settlement lines
  - ledger
  - recent preset

---

## 14. Đề xuất service/use-case trong backend

## 14.1 Use cases chính

- `CreatePlayerUseCase`
- `UpdatePlayerUseCase`
- `ListPlayersUseCase`
- `CreateRuleSetUseCase`
- `UpdateRuleSetUseCase`
- `CreateMatchUseCase`
- `GetMatchDetailUseCase`
- `ListMatchesUseCase`
- `GetMatchStakesSummaryUseCase`
- `GetMatchStakesLedgerUseCase`
- `GetGroupFundSummaryUseCase`
- `GetGroupFundLedgerUseCase`
- `GetRecentMatchPresetUseCase`

## 14.2 Domain services chính

- `MatchCalculationEngine`
- `RuleSetEvaluator`
- `BasePlacementRuleEvaluator`
- `AbsolutePlacementModifierEvaluator`
- `SettlementLineBuilder`
- `LedgerPostingService`
- `DebtSimplificationService`
- `FundSummaryService`

---

## 15. DTO / contract backend gợi ý

## 15.1 Create match request

```json
{
  "groupId": "uuid",
  "moduleType": "MATCH_STAKES",
  "ruleSetId": "uuid",
  "playedAt": "2026-03-22T12:00:00+07:00",
  "note": "late night game",
  "participants": [
    { "playerId": "uuid-a", "tftPlacement": 1 },
    { "playerId": "uuid-b", "tftPlacement": 4 },
    { "playerId": "uuid-c", "tftPlacement": 8 }
  ]
}
```

## 15.2 Match detail response

```json
{
  "match": {
    "id": "uuid",
    "moduleType": "MATCH_STAKES",
    "playedAt": "2026-03-22T05:00:00.000Z",
    "note": "late night game"
  },
  "participants": [
    {
      "playerId": "uuid-a",
      "displayName": "A",
      "tftPlacement": 1,
      "relativeRank": 1,
      "net": 110000
    }
  ],
  "ruleSnapshot": {},
  "settlementLines": [
    {
      "ruleCode": "BASE_3P_RANK_1",
      "source": "player-b",
      "destination": "player-a",
      "amount": 50000,
      "reason": "Base settlement for 3-player match"
    }
  ]
}
```

---

## 16. Quy tắc mở rộng trong tương lai

Thiết kế backend này cho phép mở rộng theo các hướng sau mà không phá cấu trúc lõi:

1. thêm participant count 5, 6, 7, 8
2. thêm loại account mới như `HOUSE`, `BONUS_POOL`, `TOURNAMENT_POT`
3. thêm recurring fund rules
4. thêm rule versioning nâng cao
5. thêm chỉnh sửa hoặc void match có bút toán đảo ngược
6. thêm authentication và preset theo user
7. thêm nhiều group độc lập
8. thêm report snapshot/materialized view nếu dữ liệu lớn

---

## 17. Khuyến nghị hiện thực hóa với Drizzle

### 17.1 Enum cần định nghĩa

- `module_type`
- `rule_type`
- `match_status`
- `line_type`
- `account_type`
- `player_ledger_entry_type`
- `fund_ledger_entry_type`
- `preset_scope_type`

### 17.2 Repository pattern vừa đủ

Không cần over-engineer, nhưng nên có repository mỏng cho:
- match write transaction
- summary read queries
- rule set loading

### 17.3 Transaction boundary

`CreateMatchUseCase` phải dùng **một transaction duy nhất** vì đây là điểm ghi nhiều bảng nhất.

---

## 18. Kết luận

Backend nên được thiết kế theo hướng **domain-first**, trong đó:

- `matches` là thực thể trung tâm
- `rule_sets` + `rules` quyết định logic settlement
- `match_rule_snapshots` + `match_settlement_lines` đảm bảo auditability
- `player_ledger` và `fund_ledger` tách riêng hai luồng kế toán
- `recent_match_presets` phục vụ UX nhập nhanh trên mobile

Thiết kế này đáp ứng trực tiếp các yêu cầu nghiệp vụ trong tài liệu mô tả hệ thống, đặc biệt là:
- tách bạch Match Stakes và Group Fund
- cho phép cấu hình luật linh hoạt
- lưu vết chi tiết lý do cộng/trừ tiền
- hỗ trợ dashboard, history, breakdown, fund summary và preset lần nhập gần nhất fileciteturn0file0.

Nếu dùng tài liệu này làm nền cho bước tiếp theo, bạn có thể triển khai tiếp:
- Drizzle schema
- ERD
- API contract cụ thể
- danh sách migration
- test cases cho calculation engine

