# Match Stakes Debt Bucket Refactor (MATCH vs ADVANCE vs COMBINED)

## 1) Van de goc (root problem)
Truoc day backend cong chung debt tu `MATCH` va debt tu `MATCH_STAKES_ADVANCE (AFFECTS_DEBT)` vao mot bucket aggregate duy nhat (`accruedNetVnd`/`outstandingNetVnd`).

He qua:
- UI khong the render tach bach 3 che do no:
  - match-only
  - advance-only
  - combined
- Timeline cumulative va period summary bi "tron nghia" giua no do match va no do ung tien.

## 2) Thay doi chinh
Backend da tach ro debt semantics thanh 3 bucket:
- `match`
- `advance`
- `combined` (match + advance)

Dong thoi van giu du lieu lich su/event trong cung period, cung unified feed, va van ho tro reset event de audit.

## 3) API da doi contract

### 3.1 Period summary/player summary APIs
Ap dung cho:
- `GET /api/v1/match-stakes/debt-periods/current`
- `GET /api/v1/match-stakes/debt-periods/:periodId`
- `GET /api/v1/match-stakes/debt-periods`
- cac response tong hop tra ve `summary` + `players`

#### Field moi trong `players[]`
- `accruedMatchNetVnd`
- `accruedAdvanceNetVnd`
- `accruedCombinedNetVnd`
- `matchNetVnd`
- `advanceNetVnd`
- `combinedNetVnd`
- `outstandingCombinedNetVnd`

#### Field cu duoc giu (backward compatibility)
- `accruedNetVnd` (hien tai tuong duong combined accrued)
- `outstandingNetVnd` (hien tai tuong duong combined outstanding)

#### Field moi trong `summary`
- `totalMatchNetReceiveVnd`
- `totalMatchNetPayVnd`
- `totalAdvanceNetReceiveVnd`
- `totalAdvanceNetPayVnd`
- `totalCombinedNetReceiveVnd`
- `totalCombinedNetPayVnd`
- `totalOutstandingCombinedReceiveVnd`
- `totalOutstandingCombinedPayVnd`
- `initialBalanceDecomposition` = `"COMBINED_ONLY"`

Field cu van giu:
- `totalOutstandingReceiveVnd`
- `totalOutstandingPayVnd`

### 3.2 Timeline API
Ap dung cho:
- `GET /api/v1/match-stakes/debt-periods/:periodId/timeline`

#### Field moi trong `timeline[].rows[]`
- `matchDeltaVnd`
- `advanceDeltaVnd`
- `combinedDeltaVnd`
- `cumulativeMatchNetVnd`
- `cumulativeAdvanceNetVnd`
- `cumulativeCombinedNetVnd`

Field cu van giu:
- `matchNetVnd` (legacy alias = combined delta)
- `cumulativeNetVnd` (legacy alias = cumulative combined)

#### Field moi trong `timeline[]`
- `eventStatus`
- `debtImpactBucket` (`MATCH` | `ADVANCE` | null)
- `debtImpactActive` (bool/null)
- `initialBalanceDecomposition` (`COMBINED_ONLY` | null)

Quy uoc:
- MATCH row: `matchDeltaVnd != 0`, `advanceDeltaVnd = 0`
- ADVANCE row (AFFECTS_DEBT + ACTIVE): `advanceDeltaVnd != 0`, `matchDeltaVnd = 0`
- ADVANCE row da RESET: van hien thi row, nhung delta active = 0 (khong cong vao cumulative)
- INITIAL row: decomposition init hien tai la `COMBINED_ONLY`

### 3.3 Unified history API
Ap dung cho:
- `GET /api/v1/match-stakes/history`
- `GET /api/v1/match-stakes/debt-periods/:periodId/history`
- response event trong create/reset history event

#### Field moi cua moi item
- `eventType`
- `impactMode`
- `affectsDebt`
- `advancerPlayerId`
- `participantPlayerIds`
- `impactLines`
- `debtImpactBucket`
- `debtImpactActive`

Cac field cu (`itemType`, `eventStatus`, `metadata`, ...) van ton tai.

## 4) Internal accounting model sau refactor

### 4.1 Advance event AFFECTS_DEBT
Khi `POST /api/v1/match-stakes/history-events` voi:
- `eventType = MATCH_STAKES_ADVANCE`
- `impactMode = AFFECTS_DEBT`

Backend van:
- validate participant-based nhu cu
- tinh `impactLines` nhu cu
- luu event + impact lines nhu cu

Nhung aggregate nay duoc classify vao `advance` bucket (khong tron vao match bucket).

### 4.2 Reset event
`POST /api/v1/match-stakes/history-events/:eventId/reset`:
- event van duoc giu cho audit (`eventStatus = RESET`)
- contribution cua event do bi loai khoi aggregate active
- anh huong den `advance` + `combined`
- khong thay doi `match` bucket

## 5) Luu y decomposition init/carry-forward
Hien tai init balance carry-forward chua co split match-vs-advance trong storage.

Backend expose ro:
- `initialBalanceDecomposition = "COMBINED_ONLY"`

Y nghia:
- init duoc coi la combined opening balance
- khong ep FE doan split init vao match hay advance

## 6) Vi du response

### 6.1 Vi du player summary (rut gon)
```json
{
  "playerId": "10000000-0000-4000-8000-000000000001",
  "playerName": "An",
  "initNetVnd": 50000,
  "accruedMatchNetVnd": 120000,
  "accruedAdvanceNetVnd": 30000,
  "accruedCombinedNetVnd": 150000,
  "matchNetVnd": 120000,
  "advanceNetVnd": 30000,
  "combinedNetVnd": 150000,
  "settledPaidVnd": 0,
  "settledReceivedVnd": 60000,
  "outstandingCombinedNetVnd": 140000,
  "outstandingNetVnd": 140000
}
```

### 6.2 Vi du timeline ADVANCE row (rut gon)
```json
{
  "type": "ADVANCE",
  "eventId": "a3f...",
  "eventType": "MATCH_STAKES_ADVANCE",
  "eventStatus": "ACTIVE",
  "impactMode": "AFFECTS_DEBT",
  "affectsDebt": true,
  "debtImpactBucket": "ADVANCE",
  "debtImpactActive": true,
  "rows": [
    {
      "playerId": "100...001",
      "matchDeltaVnd": 0,
      "advanceDeltaVnd": 37500,
      "combinedDeltaVnd": 37500,
      "cumulativeMatchNetVnd": 120000,
      "cumulativeAdvanceNetVnd": 30000,
      "cumulativeCombinedNetVnd": 200000
    }
  ]
}
```

### 6.3 Vi du history ADVANCE item (rut gon)
```json
{
  "id": "a3f...",
  "itemType": "ADVANCE",
  "eventType": "MATCH_STAKES_ADVANCE",
  "eventStatus": "ACTIVE",
  "impactMode": "AFFECTS_DEBT",
  "affectsDebt": true,
  "advancerPlayerId": "10000000-0000-4000-8000-000000000001",
  "participantPlayerIds": [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002"
  ],
  "impactLines": [
    {
      "playerId": "10000000-0000-4000-8000-000000000001",
      "allocatedShareVnd": 25000,
      "netDeltaVnd": 25000
    },
    {
      "playerId": "10000000-0000-4000-8000-000000000002",
      "allocatedShareVnd": 25000,
      "netDeltaVnd": -25000
    }
  ],
  "debtImpactBucket": "ADVANCE",
  "debtImpactActive": true
}
```

## 7) Backward compatibility
- Khong xoa field cu:
  - `accruedNetVnd`
  - `outstandingNetVnd`
  - timeline row `matchNetVnd`, `cumulativeNetVnd`
- Field cu duoc giu de FE cu tiep tuc chay.
- Nguon truth moi cho UI 3-mode la cac field explicit `match/advance/combined`.
