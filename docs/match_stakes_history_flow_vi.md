# Luong API Match Stakes History (Backend hien tai)

Tai lieu nay mo ta luong backend da cap nhat cho:
- `POST /api/v1/match-stakes/history-events`
- `POST /api/v1/match-stakes/history-events/:eventId/reset`
- `GET /api/v1/match-stakes/history`
- `GET /api/v1/match-stakes/debt-periods/:periodId/timeline`

Luu y:
- Endpoint dung trong code la `match-stakes/history-events` (so nhieu).
- Write API (`POST/PUT/PATCH/DELETE`) duoi `/api/v1` yeu cau JWT va role `ADMIN`.

## 1) Tao history event: `POST /api/v1/match-stakes/history-events`

## 1.1 Contract moi cho `MATCH_STAKES_ADVANCE`

Body cho nhanh `MATCH_STAKES_ADVANCE`:
- `eventType`: bat buoc, gia tri `MATCH_STAKES_ADVANCE`
- `playerId`: bat buoc, la nguoi ung tien (advancer)
- `amountVnd`: bat buoc, so nguyen duong
- `impactMode`: optional (`AFFECTS_DEBT` hoac `INFORMATIONAL`), alias `INFORMATION_ONLY` duoc map sang `INFORMATIONAL`
- `participantPlayerIds`: **contract chinh moi**, danh sach nguoi tham gia/chia chi phi
- `beneficiaryPlayerIds`: optional, giu tam thoi de backward compatibility (legacy)
- `debtPeriodId`: optional (neu khong co se lay period `OPEN` hien tai)
- `postedAt`, `note`: optional

Rule validate cho `AFFECTS_DEBT`:
- `participantPlayerIds` khong duoc rong (hoac tam thoi co the gui legacy `beneficiaryPlayerIds`)
- danh sach player id phai unique
- `playerId` (advancer) phai nam trong `participantPlayerIds`
- tat ca participant phai la active member trong group
- debt period phai ton tai va dang `OPEN`

Quan trong:
- Khong con default ngam theo kieu "tat ca active player tru advancer".

## 1.2 Backward compatibility tam thoi

Neu FE cu gui `beneficiaryPlayerIds` ma chua gui `participantPlayerIds`:
- Backend se map tam thoi thanh participants bang:
  - `participantPlayerIds = unique(beneficiaryPlayerIds + [playerId])`
- Muc tieu la giu khong vo ngay payload cu, dong thoi van dam bao cong thuc chia dung theo participant.

## 1.3 Cong thuc tinh impact (`AFFECTS_DEBT`)

Input:
- `participants = participantPlayerIds`
- `advancer = playerId`
- `amount = amountVnd`

Tinh toan:
1. Sort participants theo `playerId` de chia phan du mot cach deterministic.
2. `baseShare = floor(amount / participantCount)`
3. `remainder = amount % participantCount`
4. Moi participant co:
   - `allocatedShare = baseShare + (index < remainder ? 1 : 0)`
   - `netDelta = -allocatedShare`
5. Advancer co them:
   - `netDelta += amount`

Dam bao:
- Tong tat ca `netDelta` = 0.
- Advancer khong bi loai khoi split neu participant set co chua advancer.

Vi du 50,000 voi 4 nguoi (bao gom advancer):
- Moi nguoi share 12,500
- Advancer net: +50,000 - 12,500 = +37,500
- 3 nguoi con lai: -12,500 moi nguoi

## 1.4 Du lieu duoc luu cho advance event

`module_history_events.metadata_json` luu ro nghia business:
- `impactMode`
- `advancerPlayerId`
- `participantPlayerIds`
- `participantCount`
- `legacyBeneficiaryPlayerIds` (neu co fallback legacy)
- `impactLines`:
  - `playerId`
  - `allocatedShareVnd`
  - `netDeltaVnd`

Dong thoi, khi `AFFECTS_DEBT`:
- Backend ghi bang `match_stakes_history_event_player_impacts` theo `netDeltaVnd`.

## 2) Reset advance event: `POST /api/v1/match-stakes/history-events/:eventId/reset`

Body:
- `reason`: optional

Flow chinh:
1. Tim event theo `eventId` + `groupId`.
2. Validate:
   - event ton tai
   - event thuoc module `MATCH_STAKES`
   - `eventType = MATCH_STAKES_ADVANCE`
   - event chua reset
   - period lien quan ton tai
3. Khong hard delete. Backend update event state:
   - `event_status = RESET`
   - `reset_at = now()`
   - `reset_reason = reason`
4. Ghi audit log action `RESET`.
5. Tra ve:
   - event da cap nhat
   - period
   - summary + players da rebuild

## 2.1 Co che bo anh huong khoi debt aggregate

He thong dung event status de loai anh huong cua event reset:
- Summary aggregate (`listPeriodPlayerAggregates`) chi cong impact cua event `event_status = ACTIVE`.
- Timeline impact rows (`listMatchStakesPeriodEventImpacts`) chi lay impact cua event `ACTIVE`.

Ket qua:
- Event van con trong history (audit duoc).
- Sau reset, no khong con tac dong vao debt outstanding.

## 3) Read API lien quan

## 3.1 `GET /api/v1/match-stakes/history`

Feed hop nhat van gom:
- `MATCH`
- `DEBT_SETTLEMENT`
- `ADVANCE`
- `NOTE`

Voi history event, response da bo sung trang thai reset:
- `eventStatus`: `ACTIVE | RESET | null`
- `resetAt`
- `resetReason`

Metadata event cung co:
- `eventType`, `impactMode`, `affectsDebt`
- `details` (metadata goc, co `participantPlayerIds`, `advancerPlayerId`, `impactLines`, ...)
- `eventStatus`, `resetAt`, `resetReason`

## 3.2 `GET /api/v1/match-stakes/debt-periods/:periodId/timeline`

Timeline van hien event reset de audit.
Nhung gia tri cong don (`cumulativeNetVnd`) chi tinh impact tu event `ACTIVE`, nen reset event khong con lam thay doi tong no.

## 4) Error codes lien quan

Cac ma loi duoc dung trong flow moi:
- `MATCH_STAKES_ADVANCE_INVALID`
- `MATCH_STAKES_ADVANCE_PARTICIPANTS_INVALID`
- `MATCH_STAKES_ADVANCE_ADVANCER_NOT_IN_PARTICIPANTS`
- `MATCH_STAKES_HISTORY_EVENT_NOT_FOUND`
- `MATCH_STAKES_HISTORY_EVENT_ALREADY_RESET`
- `MATCH_STAKES_HISTORY_EVENT_INVALID`
- `DEBT_PERIOD_NOT_FOUND`
- `DEBT_PERIOD_NOT_OPEN`

## 5) Tom tat thay doi nghiep vu quan trong

- Advance AFFECTS_DEBT da chuyen sang tu duy participant-based.
- Advancer phai nam trong participant set va duoc chia chi phi nhu participant thong thuong.
- Khong con fallback sai "all active players except advancer".
- Co API reset de vo hieu hoa tac dong debt ma khong xoa event.
- Debt aggregate/timeline da duoc chinh de bo qua event `RESET`.
