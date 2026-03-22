# TFT History API Test Playbook (Seed DB Based)

> Mục tiêu: test nghiệp vụ API theo **đúng seed DB hiện tại**.  
> File này ưu tiên:
> - test theo **thứ tự nên gọi**
> - có **request mẫu**
> - có **response mẫu**
> - phân biệt rõ phần nào là **ổn định theo seed**, phần nào là **động** (`id`, `timestamp`, `createdAt`...)

---

## 0. Đánh giá nhanh guide hiện tại

Guide mới **ổn hơn bản trước khá nhiều** vì đã sửa được các điểm quan trọng:

- endpoint default rule set đã có `participantCount`
- player active semantics đã chuyển sang `group_members.is_active`
- đã có manual Group Fund transaction APIs
- flow match creation đã rõ hơn

### Vẫn nên chỉnh thêm 4 điểm

1. `GET /api/v1/rule-sets/:ruleSetId` vẫn còn `rules: []` trong version list item  
   -> nên bỏ field này hoặc thay bằng `ruleCount`.

2. `GET /api/v1/match-stakes/summary` vẫn còn `debtSuggestions: []`  
   -> nếu chưa implement thật thì nên để `null` hoặc bỏ khỏi contract.

3. `MatchParticipantDto.isWinnerAmongParticipants` đang optional  
   -> nên luôn trả boolean.

4. Nên ghi rõ hơn semantics của `from`, `to`, `playedAt`, `postedAt`  
   -> dùng ISO datetime, và nên nói rõ `from` inclusive / `to` inclusive hay exclusive.

---

## 1. Seed DB baseline dùng để test

### 1.1 Group mặc định

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "code": "TFT_FRIENDS",
  "name": "TFT Friends"
}
```

### 1.2 Players seed

| Player | id | slug |
|---|---|---|
| An | `22222222-2222-2222-2222-222222222221` | `an` |
| Binh | `22222222-2222-2222-2222-222222222222` | `binh` |
| Chi | `22222222-2222-2222-2222-222222222223` | `chi` |
| Dung | `22222222-2222-2222-2222-222222222224` | `dung` |

### 1.3 Rule sets seed

#### Match Stakes default
- ruleSetId: `44444444-4444-4444-4444-444444444441`

Versions:
- 3 players: `55555555-5555-5555-5555-555555555531`
- 4 players: `55555555-5555-5555-5555-555555555532`

#### Group Fund default
- ruleSetId: `44444444-4444-4444-4444-444444444442`

Version:
- 3 players: `55555555-5555-5555-5555-555555555533`

### 1.4 Ledger accounts seed

#### System / fund
- FUND_MAIN: `33333333-3333-3333-3333-333333333331`
- SYSTEM_HOLDING: `33333333-3333-3333-3333-333333333332`

#### Match Stakes player debt accounts
- An: `33333333-3333-3333-3333-333333333341`
- Binh: `33333333-3333-3333-3333-333333333342`
- Chi: `33333333-3333-3333-3333-333333333343`
- Dung: `33333333-3333-3333-3333-333333333344`

#### Group Fund obligation accounts
- An: `33333333-3333-3333-3333-333333333351`
- Binh: `33333333-3333-3333-3333-333333333352`
- Chi: `33333333-3333-3333-3333-333333333353`
- Dung: `33333333-3333-3333-3333-333333333354`

---

## 2. Quy ước test

### 2.1 Base URL

```bash
export BASE_URL=http://localhost:3001
```

Hoặc đổi theo port thực tế của bạn.

### 2.2 Không có auth
Guide hiện tại chưa mô tả auth, nên các request bên dưới không kèm token.

### 2.3 Field động

Những field sau thường **không cố định**:
- `id` sinh mới
- `createdAt`
- `updatedAt`
- `playedAt`
- `postedAt`
- `voidedAt`

Trong response mẫu, các field này được viết như:
- `<MATCH_ID>`
- `<SETTLEMENT_ID>`
- `<ISO_TS_NOW>`

### 2.4 Khuyến nghị thứ tự test

Nên test theo thứ tự này:

1. Health + players  
2. Rule sets + default rule resolution  
3. Match Stakes create -> list -> detail -> summary -> ledger  
4. Recent preset + dashboard  
5. Group Fund match create -> list -> detail -> summary -> ledger  
6. Manual Group Fund transactions  
7. Void match (**để cuối cùng** vì nó làm thay đổi ledger và summary)

---

## 3. Bước 1 — Health + Players

---

### 3.1 GET `/`

```bash
curl -s "$BASE_URL/"
```

### Expected response

```json
{
  "success": true,
  "data": {
    "service": "tft-history-api",
    "status": "ready"
  }
}
```

---

### 3.2 GET `/api/v1/health`

```bash
curl -s "$BASE_URL/api/v1/health"
```

### Expected response

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "tft-history-api",
    "timestamp": "<ISO_TS_NOW>"
  }
}
```

---

### 3.3 GET `/api/v1/players`

```bash
curl -s "$BASE_URL/api/v1/players?page=1&pageSize=20"
```

### Expected response mẫu

```json
{
  "success": true,
  "data": [
    {
      "id": "22222222-2222-2222-2222-222222222221",
      "displayName": "An",
      "slug": "an",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "displayName": "Binh",
      "slug": "binh",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    },
    {
      "id": "22222222-2222-2222-2222-222222222223",
      "displayName": "Chi",
      "slug": "chi",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    },
    {
      "id": "22222222-2222-2222-2222-222222222224",
      "displayName": "Dung",
      "slug": "dung",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

---

### 3.4 GET `/api/v1/players/:playerId`

```bash
curl -s "$BASE_URL/api/v1/players/22222222-2222-2222-2222-222222222221"
```

### Expected response

```json
{
  "success": true,
  "data": {
    "id": "22222222-2222-2222-2222-222222222221",
    "displayName": "An",
    "slug": "an",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "<ISO_TS_SEED>",
    "updatedAt": "<ISO_TS_SEED>"
  }
}
```

---

## 4. Bước 2 — Rule sets + default rule resolution

---

### 4.1 GET `/api/v1/rule-sets`

```bash
curl -s "$BASE_URL/api/v1/rule-sets?page=1&pageSize=20"
```

### Expected response tối thiểu

```json
{
  "success": true,
  "data": [
    {
      "id": "44444444-4444-4444-4444-444444444441",
      "module": "MATCH_STAKES",
      "code": "MATCH_STAKES_DEFAULT",
      "name": "Match Stakes Default",
      "description": "Default Match Stakes rule set for 3/4 players",
      "status": "ACTIVE",
      "isDefault": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    },
    {
      "id": "44444444-4444-4444-4444-444444444442",
      "module": "GROUP_FUND",
      "code": "GROUP_FUND_DEFAULT",
      "name": "Group Fund Default",
      "description": "Default Group Fund rule set for 3 players",
      "status": "ACTIVE",
      "isDefault": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### 4.2 GET `/api/v1/rule-sets/default/by-module/MATCH_STAKES?participantCount=3`

```bash
curl -s "$BASE_URL/api/v1/rule-sets/default/by-module/MATCH_STAKES?participantCount=3"
```

### Expected response

```json
{
  "success": true,
  "data": {
    "ruleSet": {
      "id": "44444444-4444-4444-4444-444444444441",
      "module": "MATCH_STAKES",
      "code": "MATCH_STAKES_DEFAULT",
      "name": "Match Stakes Default",
      "description": "Default Match Stakes rule set for 3/4 players",
      "status": "ACTIVE",
      "isDefault": true,
      "createdAt": "<ISO_TS_SEED>",
      "updatedAt": "<ISO_TS_SEED>"
    },
    "activeVersion": {
      "id": "55555555-5555-5555-5555-555555555531",
      "ruleSetId": "44444444-4444-4444-4444-444444444441",
      "versionNo": 1,
      "participantCountMin": 3,
      "participantCountMax": 3,
      "effectiveFrom": "<ISO_TS_SEED>",
      "effectiveTo": null,
      "isActive": true,
      "summaryJson": {
        "name": "Match Stakes 3-player default"
      },
      "createdAt": "<ISO_TS_SEED>",
      "rules": [
        {
          "code": "MS3_BASE_WINNER"
        },
        {
          "code": "MS3_TOP1_TOP2_PENALTY"
        },
        {
          "code": "MS3_TOP8_PENALTY"
        }
      ]
    }
  }
}
```

---

### 4.3 GET `/api/v1/rule-sets/default/by-module/MATCH_STAKES?participantCount=4`

```bash
curl -s "$BASE_URL/api/v1/rule-sets/default/by-module/MATCH_STAKES?participantCount=4"
```

### Expected response quan trọng

`activeVersion.id` phải là:

```json
"55555555-5555-5555-5555-555555555532"
```

Nếu vẫn ra `...5531` thì backend vẫn còn bug hard-code participantCount=3.

---

### 4.4 GET `/api/v1/rule-sets/default/by-module/GROUP_FUND?participantCount=3`

```bash
curl -s "$BASE_URL/api/v1/rule-sets/default/by-module/GROUP_FUND?participantCount=3"
```

### Expected response quan trọng

`activeVersion.id` phải là:

```json
"55555555-5555-5555-5555-555555555533"
```

---

## 5. Bước 3 — Match Stakes 3 người: tạo trận và verify

### Kịch bản
Dùng 3 người:
- An: placement 1
- Binh: placement 2
- Chi: placement 8

Theo seed rules 3P Match Stakes:
- Binh -> An: 50000
- Chi -> An: 50000
- Binh -> An: 10000 (top1-top2 penalty)
- Chi -> An: 10000 (top8 penalty)

### Kết quả net kỳ vọng
- An: `+120000`
- Binh: `-60000`
- Chi: `-60000`

### Tổng transfer kỳ vọng
- `120000`

---

### 5.1 POST `/api/v1/matches`

```bash
curl -s -X POST "$BASE_URL/api/v1/matches" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "MATCH_STAKES",
    "ruleSetId": "44444444-4444-4444-4444-444444444441",
    "ruleSetVersionId": "55555555-5555-5555-5555-555555555531",
    "note": "MS 3P seed scenario",
    "participants": [
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "tftPlacement": 1
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222222",
        "tftPlacement": 2
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "tftPlacement": 8
      }
    ]
  }'
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "id": "<MATCH_MS3_ID>",
    "module": "MATCH_STAKES",
    "playedAt": "<ISO_TS_NOW>",
    "participantCount": 3,
    "status": "POSTED",
    "note": "MS 3P seed scenario",
    "ruleSet": {
      "id": "44444444-4444-4444-4444-444444444441",
      "name": "Match Stakes Default",
      "module": "MATCH_STAKES"
    },
    "ruleSetVersion": {
      "id": "55555555-5555-5555-5555-555555555531",
      "versionNo": 1,
      "participantCountMin": 3,
      "participantCountMax": 3,
      "effectiveFrom": "<ISO_TS_SEED>",
      "effectiveTo": null
    },
    "participants": [
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "playerName": "An",
        "tftPlacement": 1,
        "relativeRank": 1,
        "isWinnerAmongParticipants": true,
        "settlementNetVnd": 120000
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222222",
        "playerName": "Binh",
        "tftPlacement": 2,
        "relativeRank": 2,
        "isWinnerAmongParticipants": false,
        "settlementNetVnd": -60000
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "playerName": "Chi",
        "tftPlacement": 8,
        "relativeRank": 3,
        "isWinnerAmongParticipants": false,
        "settlementNetVnd": -60000
      }
    ],
    "settlement": {
      "id": "<SETTLEMENT_MS3_ID>",
      "totalTransferVnd": 120000,
      "totalFundInVnd": 0,
      "totalFundOutVnd": 0,
      "engineVersion": "<ENGINE_VERSION>",
      "ruleSnapshot": "<JSON>",
      "resultSnapshot": "<JSON>",
      "postedToLedgerAt": "<ISO_TS_NOW>",
      "lines": [
        {
          "id": "<LINE_1>",
          "lineNo": 1,
          "ruleId": "66666666-6666-6666-6666-666666666631",
          "ruleCode": "MS3_BASE_WINNER",
          "ruleName": "3P Winner Base",
          "sourceAccountId": "33333333-3333-3333-3333-333333333342",
          "destinationAccountId": "33333333-3333-3333-3333-333333333341",
          "sourcePlayerId": "22222222-2222-2222-2222-222222222222",
          "sourcePlayerName": "Binh",
          "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
          "destinationPlayerName": "An",
          "amountVnd": 50000,
          "reasonText": "Base 3P: rank2 pays winner 50000",
          "metadata": "<JSON_OR_NULL>"
        },
        {
          "id": "<LINE_2>",
          "lineNo": 2,
          "ruleId": "66666666-6666-6666-6666-666666666631",
          "ruleCode": "MS3_BASE_WINNER",
          "ruleName": "3P Winner Base",
          "sourceAccountId": "33333333-3333-3333-3333-333333333343",
          "destinationAccountId": "33333333-3333-3333-3333-333333333341",
          "sourcePlayerId": "22222222-2222-2222-2222-222222222223",
          "sourcePlayerName": "Chi",
          "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
          "destinationPlayerName": "An",
          "amountVnd": 50000,
          "reasonText": "Base 3P: rank3 pays winner 50000",
          "metadata": "<JSON_OR_NULL>"
        },
        {
          "id": "<LINE_3>",
          "lineNo": 3,
          "ruleId": "66666666-6666-6666-6666-666666666632",
          "ruleCode": "MS3_TOP1_TOP2_PENALTY",
          "ruleName": "Top1-Top2 Penalty",
          "sourceAccountId": "33333333-3333-3333-3333-333333333342",
          "destinationAccountId": "33333333-3333-3333-3333-333333333341",
          "sourcePlayerId": "22222222-2222-2222-2222-222222222222",
          "sourcePlayerName": "Binh",
          "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
          "destinationPlayerName": "An",
          "amountVnd": 10000,
          "reasonText": "Penalty: top2 pays top1 10000",
          "metadata": "<JSON_OR_NULL>"
        },
        {
          "id": "<LINE_4>",
          "lineNo": 4,
          "ruleId": "66666666-6666-6666-6666-666666666633",
          "ruleCode": "MS3_TOP8_PENALTY",
          "ruleName": "Top8 Penalty",
          "sourceAccountId": "33333333-3333-3333-3333-333333333343",
          "destinationAccountId": "33333333-3333-3333-3333-333333333341",
          "sourcePlayerId": "22222222-2222-2222-2222-222222222223",
          "sourcePlayerName": "Chi",
          "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
          "destinationPlayerName": "An",
          "amountVnd": 10000,
          "reasonText": "Penalty: top8 pays best participant 10000",
          "metadata": "<JSON_OR_NULL>"
        }
      ]
    },
    "voidReason": null,
    "voidedAt": null,
    "createdAt": "<ISO_TS_NOW>",
    "updatedAt": "<ISO_TS_NOW>"
  }
}
```

### Sau khi tạo match
Lưu lại:
- `MATCH_MS3_ID = data.id`
- `SETTLEMENT_MS3_ID = data.settlement.id`

---

### 5.2 GET `/api/v1/matches/:matchId`

```bash
curl -s "$BASE_URL/api/v1/matches/<MATCH_MS3_ID>"
```

### Expected
Phải phản chiếu đúng dữ liệu ở bước create:
- `status = POSTED`
- `participantCount = 3`
- settlement 4 lines
- `totalTransferVnd = 120000`

---

### 5.3 GET `/api/v1/matches?module=MATCH_STAKES`

```bash
curl -s "$BASE_URL/api/v1/matches?module=MATCH_STAKES&page=1&pageSize=20"
```

### Expected response mẫu tối thiểu

```json
{
  "success": true,
  "data": [
    {
      "id": "<MATCH_MS3_ID>",
      "module": "MATCH_STAKES",
      "playedAt": "<ISO_TS_NOW>",
      "participantCount": 3,
      "ruleSetId": "44444444-4444-4444-4444-444444444441",
      "ruleSetName": "Match Stakes Default",
      "ruleSetVersionId": "55555555-5555-5555-5555-555555555531",
      "ruleSetVersionNo": 1,
      "notePreview": "MS 3P seed scenario",
      "status": "POSTED",
      "participants": [
        {
          "playerId": "22222222-2222-2222-2222-222222222221",
          "playerName": "An",
          "tftPlacement": 1,
          "relativeRank": 1,
          "isWinnerAmongParticipants": true,
          "settlementNetVnd": 120000
        },
        {
          "playerId": "22222222-2222-2222-2222-222222222222",
          "playerName": "Binh",
          "tftPlacement": 2,
          "relativeRank": 2,
          "isWinnerAmongParticipants": false,
          "settlementNetVnd": -60000
        },
        {
          "playerId": "22222222-2222-2222-2222-222222222223",
          "playerName": "Chi",
          "tftPlacement": 8,
          "relativeRank": 3,
          "isWinnerAmongParticipants": false,
          "settlementNetVnd": -60000
        }
      ],
      "totalTransferVnd": 120000,
      "totalFundInVnd": 0,
      "totalFundOutVnd": 0,
      "createdAt": "<ISO_TS_NOW>"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 5.4 GET `/api/v1/match-stakes/summary`

```bash
curl -s "$BASE_URL/api/v1/match-stakes/summary"
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "module": "MATCH_STAKES",
    "players": [
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "playerName": "An",
        "totalNetVnd": 120000,
        "totalMatches": 1,
        "firstPlaceCountAmongParticipants": 1,
        "biggestLossCount": 0
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222222",
        "playerName": "Binh",
        "totalNetVnd": -60000,
        "totalMatches": 1,
        "firstPlaceCountAmongParticipants": 0,
        "biggestLossCount": 1
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "playerName": "Chi",
        "totalNetVnd": -60000,
        "totalMatches": 1,
        "firstPlaceCountAmongParticipants": 0,
        "biggestLossCount": 1
      }
    ],
    "debtSuggestions": [],
    "totalMatches": 1,
    "range": {
      "from": null,
      "to": null
    }
  }
}
```

> Ghi chú: nếu implementation vẫn trả cả Dung với số 0 thì vẫn có thể chấp nhận, tùy cách aggregate.

---

### 5.5 GET `/api/v1/match-stakes/ledger`

```bash
curl -s "$BASE_URL/api/v1/match-stakes/ledger?page=1&pageSize=20"
```

### Expected response mẫu

```json
{
  "success": true,
  "data": [
    {
      "entryId": "<ENTRY_1>",
      "postedAt": "<ISO_TS_NOW>",
      "matchId": "<MATCH_MS3_ID>",
      "sourcePlayerId": "22222222-2222-2222-2222-222222222222",
      "sourcePlayerName": "Binh",
      "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
      "destinationPlayerName": "An",
      "amountVnd": 50000,
      "entryReason": "Base 3P: rank2 pays winner 50000",
      "ruleCode": "MS3_BASE_WINNER",
      "ruleName": "3P Winner Base"
    },
    {
      "entryId": "<ENTRY_2>",
      "postedAt": "<ISO_TS_NOW>",
      "matchId": "<MATCH_MS3_ID>",
      "sourcePlayerId": "22222222-2222-2222-2222-222222222223",
      "sourcePlayerName": "Chi",
      "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
      "destinationPlayerName": "An",
      "amountVnd": 50000,
      "entryReason": "Base 3P: rank3 pays winner 50000",
      "ruleCode": "MS3_BASE_WINNER",
      "ruleName": "3P Winner Base"
    },
    {
      "entryId": "<ENTRY_3>",
      "postedAt": "<ISO_TS_NOW>",
      "matchId": "<MATCH_MS3_ID>",
      "sourcePlayerId": "22222222-2222-2222-2222-222222222222",
      "sourcePlayerName": "Binh",
      "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
      "destinationPlayerName": "An",
      "amountVnd": 10000,
      "entryReason": "Penalty: top2 pays top1 10000",
      "ruleCode": "MS3_TOP1_TOP2_PENALTY",
      "ruleName": "Top1-Top2 Penalty"
    },
    {
      "entryId": "<ENTRY_4>",
      "postedAt": "<ISO_TS_NOW>",
      "matchId": "<MATCH_MS3_ID>",
      "sourcePlayerId": "22222222-2222-2222-2222-222222222223",
      "sourcePlayerName": "Chi",
      "destinationPlayerId": "22222222-2222-2222-2222-222222222221",
      "destinationPlayerName": "An",
      "amountVnd": 10000,
      "entryReason": "Penalty: top8 pays best participant 10000",
      "ruleCode": "MS3_TOP8_PENALTY",
      "ruleName": "Top8 Penalty"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

---

### 5.6 GET `/api/v1/match-stakes/matches`

```bash
curl -s "$BASE_URL/api/v1/match-stakes/matches?page=1&pageSize=20"
```

### Expected
Kết quả tương tự `GET /api/v1/matches?module=MATCH_STAKES`.

---

## 6. Bước 4 — Recent preset + Dashboard sau Match Stakes

---

### 6.1 GET `/api/v1/recent-match-presets/MATCH_STAKES`

```bash
curl -s "$BASE_URL/api/v1/recent-match-presets/MATCH_STAKES"
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "module": "MATCH_STAKES",
    "lastRuleSetId": "44444444-4444-4444-4444-444444444441",
    "lastRuleSetVersionId": "55555555-5555-5555-5555-555555555531",
    "lastSelectedPlayerIds": [
      "22222222-2222-2222-2222-222222222221",
      "22222222-2222-2222-2222-222222222222",
      "22222222-2222-2222-2222-222222222223"
    ],
    "lastParticipantCount": 3,
    "lastUsedAt": "<ISO_TS_NOW>"
  }
}
```

---

### 6.2 GET `/api/v1/dashboard/overview`

```bash
curl -s "$BASE_URL/api/v1/dashboard/overview"
```

### Expected tối thiểu

```json
{
  "success": true,
  "data": {
    "playerCount": 4,
    "totalMatches": 1,
    "matchStakes": {
      "totalMatches": 1,
      "topPlayers": [
        {
          "playerId": "22222222-2222-2222-2222-222222222221",
          "playerName": "An",
          "totalNetVnd": 120000
        }
      ]
    },
    "groupFund": {
      "totalMatches": 0,
      "fundBalanceVnd": 0,
      "topContributors": []
    },
    "recentMatches": [
      {
        "id": "<MATCH_MS3_ID>",
        "module": "MATCH_STAKES"
      }
    ]
  }
}
```

---

## 7. Bước 5 — Group Fund 3 người: tạo trận và verify

### Kịch bản
Dùng:
- An: placement 1
- Binh: placement 4
- Chi: placement 8

Relative ranks:
- An = 1
- Binh = 2
- Chi = 3

Theo seed Group Fund rules:
- rank2 contributes 10000
- rank3 contributes 20000

### Kết quả kỳ vọng
- `totalFundInVnd = 30000`
- `totalTransferVnd = 0`
- fund tăng thêm `30000`

---

### 7.1 POST `/api/v1/matches`

```bash
curl -s -X POST "$BASE_URL/api/v1/matches" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "GROUP_FUND",
    "ruleSetId": "44444444-4444-4444-4444-444444444442",
    "ruleSetVersionId": "55555555-5555-5555-5555-555555555533",
    "note": "GF 3P seed scenario",
    "participants": [
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "tftPlacement": 1
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222222",
        "tftPlacement": 4
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "tftPlacement": 8
      }
    ]
  }'
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "id": "<MATCH_GF3_ID>",
    "module": "GROUP_FUND",
    "playedAt": "<ISO_TS_NOW>",
    "participantCount": 3,
    "status": "POSTED",
    "note": "GF 3P seed scenario",
    "ruleSet": {
      "id": "44444444-4444-4444-4444-444444444442",
      "name": "Group Fund Default",
      "module": "GROUP_FUND"
    },
    "ruleSetVersion": {
      "id": "55555555-5555-5555-5555-555555555533",
      "versionNo": 1,
      "participantCountMin": 3,
      "participantCountMax": 3,
      "effectiveFrom": "<ISO_TS_SEED>",
      "effectiveTo": null
    },
    "participants": [
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "playerName": "An",
        "tftPlacement": 1,
        "relativeRank": 1,
        "isWinnerAmongParticipants": true,
        "settlementNetVnd": 0
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222222",
        "playerName": "Binh",
        "tftPlacement": 4,
        "relativeRank": 2,
        "isWinnerAmongParticipants": false,
        "settlementNetVnd": -10000
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "playerName": "Chi",
        "tftPlacement": 8,
        "relativeRank": 3,
        "isWinnerAmongParticipants": false,
        "settlementNetVnd": -20000
      }
    ],
    "settlement": {
      "id": "<SETTLEMENT_GF3_ID>",
      "totalTransferVnd": 0,
      "totalFundInVnd": 30000,
      "totalFundOutVnd": 0,
      "engineVersion": "<ENGINE_VERSION>",
      "ruleSnapshot": "<JSON>",
      "resultSnapshot": "<JSON>",
      "postedToLedgerAt": "<ISO_TS_NOW>",
      "lines": [
        {
          "id": "<GF_LINE_1>",
          "lineNo": 1,
          "ruleId": "66666666-6666-6666-6666-666666666651",
          "ruleCode": "GF3_RANK2_CONTRIBUTION",
          "ruleName": "Rank2 Contribution",
          "sourceAccountId": "33333333-3333-3333-3333-333333333352",
          "destinationAccountId": "33333333-3333-3333-3333-333333333331",
          "sourcePlayerId": "22222222-2222-2222-2222-222222222222",
          "sourcePlayerName": "Binh",
          "destinationPlayerId": null,
          "destinationPlayerName": null,
          "amountVnd": 10000,
          "reasonText": "Group fund: rank2 contributes 10000",
          "metadata": "<JSON_OR_NULL>"
        },
        {
          "id": "<GF_LINE_2>",
          "lineNo": 2,
          "ruleId": "66666666-6666-6666-6666-666666666652",
          "ruleCode": "GF3_RANK3_CONTRIBUTION",
          "ruleName": "Rank3 Contribution",
          "sourceAccountId": "33333333-3333-3333-3333-333333333353",
          "destinationAccountId": "33333333-3333-3333-3333-333333333331",
          "sourcePlayerId": "22222222-2222-2222-2222-222222222223",
          "sourcePlayerName": "Chi",
          "destinationPlayerId": null,
          "destinationPlayerName": null,
          "amountVnd": 20000,
          "reasonText": "Group fund: rank3 contributes 20000",
          "metadata": "<JSON_OR_NULL>"
        }
      ]
    },
    "voidReason": null,
    "voidedAt": null,
    "createdAt": "<ISO_TS_NOW>",
    "updatedAt": "<ISO_TS_NOW>"
  }
}
```

---

### 7.2 GET `/api/v1/group-fund/summary`

```bash
curl -s "$BASE_URL/api/v1/group-fund/summary"
```

### Expected tối thiểu

```json
{
  "success": true,
  "data": {
    "module": "GROUP_FUND",
    "fundBalanceVnd": 30000,
    "totalMatches": 1,
    "players": [
      {
        "playerId": "22222222-2222-2222-2222-222222222222",
        "playerName": "Binh",
        "totalContributedVnd": 10000,
        "currentObligationVnd": "<IMPLEMENTATION_DEPENDENT>"
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "playerName": "Chi",
        "totalContributedVnd": 20000,
        "currentObligationVnd": "<IMPLEMENTATION_DEPENDENT>"
      }
    ],
    "range": {
      "from": null,
      "to": null
    }
  }
}
```

> Ghi chú quan trọng: `currentObligationVnd` phụ thuộc cách backend tính balance/sign cho `PLAYER_FUND_OBLIGATION`, nên field này cần verify bằng implementation thực tế.  
> Nhưng `fundBalanceVnd = 30000` là kỳ vọng rất mạnh.

---

### 7.3 GET `/api/v1/group-fund/ledger`

```bash
curl -s "$BASE_URL/api/v1/group-fund/ledger?page=1&pageSize=20"
```

### Expected response mẫu

```json
{
  "success": true,
  "data": [
    {
      "entryId": "<GF_ENTRY_1>",
      "postedAt": "<ISO_TS_NOW>",
      "matchId": "<MATCH_GF3_ID>",
      "relatedPlayerId": "22222222-2222-2222-2222-222222222222",
      "relatedPlayerName": "Binh",
      "amountVnd": 10000,
      "movementType": "FUND_IN",
      "entryReason": "Group fund: rank2 contributes 10000",
      "ruleCode": "GF3_RANK2_CONTRIBUTION",
      "ruleName": "Rank2 Contribution"
    },
    {
      "entryId": "<GF_ENTRY_2>",
      "postedAt": "<ISO_TS_NOW>",
      "matchId": "<MATCH_GF3_ID>",
      "relatedPlayerId": "22222222-2222-2222-2222-222222222223",
      "relatedPlayerName": "Chi",
      "amountVnd": 20000,
      "movementType": "FUND_IN",
      "entryReason": "Group fund: rank3 contributes 20000",
      "ruleCode": "GF3_RANK3_CONTRIBUTION",
      "ruleName": "Rank3 Contribution"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### 7.4 GET `/api/v1/group-fund/matches`

```bash
curl -s "$BASE_URL/api/v1/group-fund/matches?page=1&pageSize=20"
```

### Expected
Có 1 item là `<MATCH_GF3_ID>` với:
- `totalTransferVnd = 0`
- `totalFundInVnd = 30000`
- `totalFundOutVnd = 0`

---

## 8. Bước 6 — Manual Group Fund transactions

> Nên test sau khi đã tạo xong match Group Fund.

---

### 8.1 POST `/api/v1/group-fund/transactions` — CONTRIBUTION

Kịch bản:
- Binh nộp thêm 15000 vào quỹ

```bash
curl -s -X POST "$BASE_URL/api/v1/group-fund/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "CONTRIBUTION",
    "playerId": "22222222-2222-2222-2222-222222222222",
    "amountVnd": 15000,
    "reason": "Manual contribution by Binh"
  }'
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "batchId": "<GF_TX_BATCH_1>",
    "postedAt": "<ISO_TS_NOW>",
    "sourceType": "MANUAL_ADJUSTMENT",
    "transactionType": "CONTRIBUTION",
    "playerId": "22222222-2222-2222-2222-222222222222",
    "playerName": "Binh",
    "amountVnd": 15000,
    "reason": "Manual contribution by Binh"
  }
}
```

---

### 8.2 POST `/api/v1/group-fund/transactions` — WITHDRAWAL

Kịch bản:
- Rút 5000 từ quỹ cho An

```bash
curl -s -X POST "$BASE_URL/api/v1/group-fund/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "WITHDRAWAL",
    "playerId": "22222222-2222-2222-2222-222222222221",
    "amountVnd": 5000,
    "reason": "Fund withdrawal to An"
  }'
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "batchId": "<GF_TX_BATCH_2>",
    "postedAt": "<ISO_TS_NOW>",
    "sourceType": "MANUAL_ADJUSTMENT",
    "transactionType": "WITHDRAWAL",
    "playerId": "22222222-2222-2222-2222-222222222221",
    "playerName": "An",
    "amountVnd": 5000,
    "reason": "Fund withdrawal to An"
  }
}
```

---

### 8.3 POST `/api/v1/group-fund/transactions` — ADJUSTMENT_IN

Kịch bản:
- chỉnh tăng quỹ 7000

```bash
curl -s -X POST "$BASE_URL/api/v1/group-fund/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "ADJUSTMENT_IN",
    "amountVnd": 7000,
    "reason": "System correction in"
  }'
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "batchId": "<GF_TX_BATCH_3>",
    "postedAt": "<ISO_TS_NOW>",
    "sourceType": "SYSTEM_CORRECTION",
    "transactionType": "ADJUSTMENT_IN",
    "playerId": null,
    "playerName": null,
    "amountVnd": 7000,
    "reason": "System correction in"
  }
}
```

---

### 8.4 POST `/api/v1/group-fund/transactions` — ADJUSTMENT_OUT

Kịch bản:
- chỉnh giảm quỹ 2000

```bash
curl -s -X POST "$BASE_URL/api/v1/group-fund/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "ADJUSTMENT_OUT",
    "amountVnd": 2000,
    "reason": "System correction out"
  }'
```

### Expected response mẫu

```json
{
  "success": true,
  "data": {
    "batchId": "<GF_TX_BATCH_4>",
    "postedAt": "<ISO_TS_NOW>",
    "sourceType": "SYSTEM_CORRECTION",
    "transactionType": "ADJUSTMENT_OUT",
    "playerId": null,
    "playerName": null,
    "amountVnd": 2000,
    "reason": "System correction out"
  }
}
```

---

### 8.5 GET `/api/v1/group-fund/transactions`

```bash
curl -s "$BASE_URL/api/v1/group-fund/transactions?page=1&pageSize=20"
```

### Expected response mẫu

```json
{
  "success": true,
  "data": [
    {
      "entryId": "<TX_ENTRY_4>",
      "batchId": "<GF_TX_BATCH_4>",
      "postedAt": "<ISO_TS_NOW>",
      "sourceType": "SYSTEM_CORRECTION",
      "transactionType": "ADJUSTMENT_OUT",
      "playerId": null,
      "playerName": null,
      "amountVnd": 2000,
      "reason": "System correction out"
    },
    {
      "entryId": "<TX_ENTRY_3>",
      "batchId": "<GF_TX_BATCH_3>",
      "postedAt": "<ISO_TS_NOW>",
      "sourceType": "SYSTEM_CORRECTION",
      "transactionType": "ADJUSTMENT_IN",
      "playerId": null,
      "playerName": null,
      "amountVnd": 7000,
      "reason": "System correction in"
    },
    {
      "entryId": "<TX_ENTRY_2>",
      "batchId": "<GF_TX_BATCH_2>",
      "postedAt": "<ISO_TS_NOW>",
      "sourceType": "MANUAL_ADJUSTMENT",
      "transactionType": "WITHDRAWAL",
      "playerId": "22222222-2222-2222-2222-222222222221",
      "playerName": "An",
      "amountVnd": 5000,
      "reason": "Fund withdrawal to An"
    },
    {
      "entryId": "<TX_ENTRY_1>",
      "batchId": "<GF_TX_BATCH_1>",
      "postedAt": "<ISO_TS_NOW>",
      "sourceType": "MANUAL_ADJUSTMENT",
      "transactionType": "CONTRIBUTION",
      "playerId": "22222222-2222-2222-2222-222222222222",
      "playerName": "Binh",
      "amountVnd": 15000,
      "reason": "Manual contribution by Binh"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

---

### 8.6 GET `/api/v1/group-fund/summary` sau manual transactions

### Fund balance kỳ vọng

Trước manual transactions:
- từ Group Fund match: `+30000`

Sau 4 transaction:
- CONTRIBUTION: `+15000`
- WITHDRAWAL: `-5000`
- ADJUSTMENT_IN: `+7000`
- ADJUSTMENT_OUT: `-2000`

### Fund balance tổng kỳ vọng
`30000 + 15000 - 5000 + 7000 - 2000 = 45000`

```bash
curl -s "$BASE_URL/api/v1/group-fund/summary"
```

### Assertion mạnh nhất

```json
{
  "success": true,
  "data": {
    "module": "GROUP_FUND",
    "fundBalanceVnd": 45000
  }
}
```

---

## 9. Bước 7 — Void match (nên test cuối)

> Chỉ nên void sau khi bạn đã verify xong match/summary/ledger ban đầu.

---

### 9.1 POST `/api/v1/matches/:matchId/void`

Void match Match Stakes ở bước 5.

```bash
curl -s -X POST "$BASE_URL/api/v1/matches/<MATCH_MS3_ID>/void" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test void flow"
  }'
```

### Expected response

```json
{
  "success": true,
  "data": {
    "id": "<MATCH_MS3_ID>",
    "status": "VOIDED",
    "reason": "Test void flow",
    "voidedAt": "<ISO_TS_NOW>"
  }
}
```

---

### 9.2 GET `/api/v1/matches/:matchId` sau void

```bash
curl -s "$BASE_URL/api/v1/matches/<MATCH_MS3_ID>"
```

### Expected tối thiểu

```json
{
  "success": true,
  "data": {
    "id": "<MATCH_MS3_ID>",
    "status": "VOIDED",
    "voidReason": "Test void flow",
    "voidedAt": "<ISO_TS_NOW>"
  }
}
```

---

### 9.3 GET `/api/v1/match-stakes/ledger` sau void

### Kỳ vọng nghiệp vụ
Sẽ có thêm **4 reversal entries** cho match đó:
- An -> Binh: 50000
- An -> Chi: 50000
- An -> Binh: 10000
- An -> Chi: 10000

Nếu ledger list expose đủ thông tin, tổng số records liên quan match này sẽ thành **8**.

> Tuy nhiên thứ tự sort và cách gắn `ruleCode/ruleName` cho reversal có thể phụ thuộc implementation, nên ở bước này nên verify bằng:
> - `matchId` đúng
> - có thêm entries ngược chiều
> - amount đúng
> - `entryReason` có prefix `REVERSAL:`

---

## 10. Negative test nên chạy thêm

---

### 10.1 Duplicate player trong cùng match

```bash
curl -s -X POST "$BASE_URL/api/v1/matches" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "MATCH_STAKES",
    "ruleSetId": "44444444-4444-4444-4444-444444444441",
    "participants": [
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "tftPlacement": 1
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222221",
        "tftPlacement": 2
      },
      {
        "playerId": "22222222-2222-2222-2222-222222222223",
        "tftPlacement": 8
      }
    ]
  }'
```

### Expected

```json
{
  "success": false,
  "error": {
    "code": "MATCH_DUPLICATE_PLAYER",
    "message": "<NON_EMPTY>"
  }
}
```

---

### 10.2 Duplicate placement trong cùng match

### Expected

```json
{
  "success": false,
  "error": {
    "code": "MATCH_DUPLICATE_PLACEMENT",
    "message": "<NON_EMPTY>"
  }
}
```

---

### 10.3 participant count không hợp lệ

Ví dụ chỉ gửi 2 người.

### Expected

```json
{
  "success": false,
  "error": {
    "code": "MATCH_PARTICIPANT_COUNT_INVALID",
    "message": "<NON_EMPTY>"
  }
}
```

---

### 10.4 player không active trong group

Có thể test bằng:
1. `DELETE /api/v1/players/:playerId` với Dung
2. Tạo match có Dung
3. kỳ vọng `MATCH_PLAYERS_INVALID`

---

### 10.5 group fund transaction thiếu playerId cho CONTRIBUTION

```bash
curl -s -X POST "$BASE_URL/api/v1/group-fund/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionType": "CONTRIBUTION",
    "amountVnd": 10000,
    "reason": "Missing player"
  }'
```

### Expected

```json
{
  "success": false,
  "error": {
    "code": "GROUP_FUND_TRANSACTION_PLAYER_REQUIRED",
    "message": "<NON_EMPTY>"
  }
}
```

---

## 11. Checklist pass/fail nhanh

### Pass nếu:
- `default/by-module` trả đúng version theo `participantCount`
- players dùng `group_members.is_active`
- Match Stakes 3P tạo ra đúng 4 settlement lines, total transfer `120000`
- Group Fund 3P tạo ra `totalFundInVnd = 30000`
- manual Group Fund transactions tạo được ledger ngoài match
- fund balance sau full scenario = `45000`
- void tạo reversal entries, không xóa ledger gốc

### Cần xem lại nếu:
- `MATCH_STAKES participantCount=4` vẫn trả version 3 người
- soft delete player làm mất player toàn cục thay vì membership current group
- `fundBalanceVnd` không lên đúng sau transactions
- void không sinh ledger đảo chiều
- summary/list trả field không nhất quán với detail/create

---

## 12. Khuyến nghị thực tế khi bạn test

- Test trong DB sạch hoặc reset seed trước mỗi vòng test
- Void để cuối cùng vì nó làm đổi ledger
- Với response aggregate (`summary`, `dashboard`), ưu tiên assert các field nghiệp vụ cốt lõi trước:
  - `totalMatches`
  - `fundBalanceVnd`
  - `totalTransferVnd`
  - net từng player
- Nếu cần golden test ổn định hơn, nên export response thực tế từ server sau khi chạy đúng 1 vòng seed scenario này, rồi dùng chính output đó làm snapshot chuẩn của project
