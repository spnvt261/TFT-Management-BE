# OpenSpec Prompt - LolChessTFT History Manager (Revised Business v2)

Dùng prompt này trong Codex sau khi bạn đã chạy `openspec init --tools codex`.

## Cách gọi khuyến nghị

```text
$openspec-propose
```

Sau đó dán toàn bộ nội dung bên dưới.

---

Tôi muốn xây dựng một web app quản lý lịch sử chơi game LolChess TFT cho nhóm bạn.

## Mục tiêu sản phẩm

Xây dựng một ứng dụng web **ưu tiên mobile-first** để:
- lưu lịch sử các trận TFT của nhóm bạn
- nhập kết quả từng trận thật nhanh trên điện thoại
- tự động tính tiền theo bộ luật có thể cấu hình
- quản lý song song **công nợ đấu giữa người chơi** và **quỹ nhóm**
- xem bảng tổng kết, lịch sử trận, lịch sử biến động tiền, lịch sử quỹ
- dễ mở rộng rule trong tương lai mà không phải sửa if/else rải rác

## Điều chỉnh nghiệp vụ mới

Tôi muốn hệ thống được tổ chức theo **3 module chính**:

1. **Kèo đấu**
   - đây là module đánh ăn tiền giữa người chơi
   - người thắng ăn tiền, người thua mất tiền theo luật của rule set được chọn
   - đây là nơi hiển thị **công nợ toàn nhóm**

2. **Quỹ nhóm**
   - đây là module không có người thắng trực tiếp
   - tiền được cộng vào hoặc trừ khỏi quỹ nhóm theo rule set được chọn
   - đây là nơi hiển thị **số dư quỹ** và **ai đang nợ quỹ bao nhiêu**

3. **Rules**
   - quản lý toàn bộ rule set và rule chi tiết
   - có màn hình: danh sách rule, chi tiết rule, thêm rule, chỉnh rule

> Hãy dùng tên module theo đúng tinh thần trên. Nếu cần, trong proposal/design có thể tinh chỉnh naming cho UI, nhưng mặc định tôi muốn dùng các tên này: **Kèo đấu**, **Quỹ nhóm**, **Rules**.

## Định hướng kỹ thuật

Hãy thiết kế và triển khai theo hướng production-ready nhưng tối ưu cho side project nhỏ, chi phí thấp.

### Frontend
- React + TypeScript
- ưu tiên Vite
- UI ưu tiên Tailwind CSS + shadcn/ui hoặc thư viện phù hợp
- mobile-first, thao tác nhanh trên màn hình nhỏ
- form dùng React Hook Form + Zod nếu cần
- data fetching/caching có thể dùng TanStack Query
- chart có thể dùng Recharts
- cần UX tốt cho thao tác nhập trận liên tục

### Backend
- TypeScript
- ưu tiên API đơn giản, dễ deploy, không cần dựng server riêng nếu chưa cần
- khuyến nghị dùng Vercel Functions hoặc kiến trúc tương thích Vercel
- cần tách rõ domain logic tính toán khỏi controller/API layer
- cần viết rule engine hoặc calculation engine đủ mềm dẻo để sau này thêm/sửa rule mà không phải sửa nhiều chỗ

### Database
- PostgreSQL
- thiết kế để lưu lâu dài
- ưu tiên phương án free hoặc gần như free
- cần migration rõ ràng
- ưu tiên ORM/type-safe query layer như Drizzle ORM

## Nghiệp vụ cốt lõi

### Ngữ cảnh chung
- nhóm bạn thường xuyên chơi TFT
- trong một trận TFT, game có 8 thứ hạng từ 1 đến 8
- nhóm chơi có ít nhất 3 người, phổ biến là 3 hoặc 4 người
- khi nhập một trận, cần lưu thứ hạng TFT thực tế của từng người trong trận
- một trận thuộc về đúng **1 module**: `Kèo đấu` hoặc `Quỹ nhóm`
- khi tạo trận, người dùng phải **chọn rule set** áp dụng cho trận đó
- mỗi trận có thể thêm **note**

### Yêu cầu UX khi tạo trận
- khi mở form tạo trận, hệ thống phải **nhớ lần tạo trận gần nhất**
- cần nhớ ít nhất:
  - những ai đã được chọn ở lần tạo gần nhất
  - rule set được chọn ở lần tạo gần nhất
  - module được chọn ở lần tạo gần nhất nếu phù hợp
- người dùng vẫn có thể chỉnh lại trước khi lưu
- trên màn hình `Kèo đấu` và `Quỹ nhóm` cần có nút `+` rõ ràng để mở form thêm trận nhanh

## Nghiệp vụ module 1: Kèo đấu

Đây là luồng đánh ăn tiền giữa người chơi.

### Quy tắc tổng quát
- đây là nơi hiển thị **công nợ luôn luôn theo full nhóm bạn**, không chỉ theo một trận hay theo nhóm người của trận gần nhất
- hệ thống cần lưu ledger đủ chi tiết để tính được:
  - tổng lãi/lỗ theo người
  - lịch sử biến động công nợ
  - lịch sử các trận thuộc module Kèo đấu
  - breakdown vì sao mỗi người được cộng/trừ bao nhiêu

### Rule mặc định hiện tại cho Kèo đấu

#### Khi có 3 người chơi
- người có thứ hạng TFT tốt nhất trong nhóm là người thắng
- 2 người còn lại là người thua
- mặc định:
  - người thắng: **+100,000đ**
  - 2 người thua: **-50,000đ mỗi người**
- các giá trị này phải là cấu hình, không hard-code

#### Khi có 4 người chơi
- người có thứ hạng TFT tốt nhất trong nhóm: **+70,000đ**
- người có thứ hạng TFT tốt thứ nhì trong nhóm: **+30,000đ**
- 2 người còn lại: **-50,000đ mỗi người**
- các giá trị này phải là cấu hình, không hard-code

### Rule đặc biệt trong Kèo đấu
- nếu trong những người tham gia trận có 1 người đứng **top 1** TFT và 1 người khác đứng **top 2** TFT, thì người top 2 bị phạt thêm **10,000đ**
- người đứng **top 8** luôn luôn bị phạt thêm **10,000đ**
- các rule đặc biệt này cũng phải cấu hình được

### Assumption cần ghi rõ trong proposal/design
Vì requirement chưa nói rõ **tiền phạt đi về đâu**, hãy thiết kế engine để **mỗi rule có thể cấu hình source/destination account rõ ràng**.

Cho MVP, hãy dùng assumption mặc định sau và ghi rõ vào proposal/design:
- rule `top1-top2 penalty`: người top 2 trả thêm 10,000đ cho người top 1 của trận
- rule `top8 penalty`: người top 8 trả thêm 10,000đ cho người có placement tốt nhất trong nhóm của trận

Nhưng kiến trúc phải đủ mở để sau này có thể đổi destination sang:
- người thắng trận
- quỹ nhóm
- một account trung gian khác

### Màn hình Kèo đấu
Phần trên:
- hiển thị **công nợ toàn nhóm**
- ưu tiên cách nhìn dễ hiểu trên mobile
- có thể hiển thị net balance theo người và/hoặc gợi ý ai đang nợ ai

Phần dưới có switch/tab để chọn cách xem:
1. **Lịch sử biến động công nợ**
   - ví dụ kiểu: datetime, người chơi, biến động `-30,000`, `+20,000`, lý do
2. **Lịch sử các trận Kèo đấu**
   - ví dụ kiểu: datetime, ai top mấy, rule nào dùng, note, tổng settlement

## Nghiệp vụ module 2: Quỹ nhóm

Đây là luồng không có người thắng trực tiếp, tiền được đưa vào hoặc lấy ra khỏi quỹ nhóm theo luật.

### Quy tắc tổng quát
- mỗi trận thuộc module `Quỹ nhóm` sẽ dùng 1 rule set phù hợp với module này
- settlement của trận sẽ tác động vào **fund ledger** thay vì công nợ đấu giữa người chơi
- cần theo dõi được:
  - số dư quỹ hiện tại
  - tổng tiền mỗi người đã đóng vào quỹ
  - số tiền mỗi người còn đang nợ quỹ (nếu có)
  - lịch sử tăng/giảm quỹ
  - lịch sử các trận thuộc module Quỹ nhóm

### Ví dụ rule mặc định đầu tiên cho Quỹ nhóm
Đây chỉ là ví dụ mở đầu, phải thiết kế để sửa được bằng cấu hình:

#### Khi có 3 người chơi
- không ai thắng trực tiếp
- 2 người có placement thấp hơn trong nhóm sẽ đóng tiền vào quỹ
- ví dụ mặc định:
  - người xếp thứ 2 trong nhóm: đóng **X**
  - người xếp thứ 3 trong nhóm: đóng **Y**
- X và Y là cấu hình

> Hãy thiết kế theo hướng tổng quát để sau này có thể thêm rule cho 4 người chơi hoặc các luật quỹ khác mà không phải viết lại engine.

### Màn hình Quỹ nhóm
Phần trên:
- hiển thị **quỹ hiện có bao nhiêu tiền**
- hiển thị **ai đang nợ quỹ bao nhiêu**
- nếu phù hợp, hiển thị thêm tổng đã đóng của từng người

Phần dưới có switch/tab để chọn cách xem:
1. **Lịch sử quỹ tăng/giảm**
   - ledger rõ ràng: datetime, ai liên quan, số tiền, loại biến động, lý do, link đến trận nếu phát sinh từ trận
2. **Lịch sử các trận Quỹ nhóm**
   - datetime, người chơi, thứ hạng, rule set, note, settlement vào quỹ

## Module Rules

Tôi muốn có màn hình quản lý rule đầy đủ cho MVP cơ bản:
- danh sách rule set
- xem chi tiết rule set
- thêm rule set
- chỉnh rule set
- bật/tắt rule
- cấu hình giá trị tiền mà không cần sửa code logic chính

Rule system cần hỗ trợ ít nhất các khái niệm sau:
- module áp dụng: `Kèo đấu` hoặc `Quỹ nhóm`
- số lượng người tham gia áp dụng: 3 hoặc 4, hoặc mở rộng thêm sau này
- base payout/contribution rule theo placement trong nhóm
- modifier rule theo placement tuyệt đối của TFT (ví dụ top1/top2/top8)
- destination/source account của từng dòng settlement
- active/inactive
- effective time hoặc versioning nếu phù hợp

## Yêu cầu domain model

Hãy thiết kế model đủ tốt để sau này mở rộng, ví dụ:
- Group
- Player
- Match
- MatchParticipant
- MatchNote
- RuleSet
- Rule
- RuleCondition
- RuleAction
- MatchSettlement
- MatchSettlementLine
- DebtLedger hoặc PlayerLedger
- FundLedger
- FundBalanceSnapshot nếu cần
- AuditLog nếu cần
- UserPreference hoặc RecentMatchPreset nếu cần cho UX nhớ lần nhập gần nhất

Hãy cân nhắc việc lưu:
- snapshot rule tại thời điểm trận được tính
- kết quả tính toán chi tiết theo từng player trong trận
- auditability: sau này xem lại vì sao một người bị cộng/trừ số tiền đó
- module của trận (`Kèo đấu` hay `Quỹ nhóm`)
- note của trận
- preset/last-used selection cho form tạo trận

## Tính năng MVP

### 1. Quản lý người chơi
- thêm/sửa/xóa người chơi
- active/inactive
- có thể gắn vào một group chính

### 2. Tạo trận đấu
- tạo trận từ module `Kèo đấu` hoặc `Quỹ nhóm`
- chọn ngày giờ
- chọn 3 hoặc 4 người chơi
- nhập thứ hạng TFT của từng người từ 1 đến 8
- validate không trùng hạng trong cùng trận
- chọn rule set áp dụng cho trận
- nhập note nếu có
- tự động tính settlement sau khi lưu
- lần tạo sau phải nhớ người chơi/rule gần nhất để tăng UX

### 3. Lịch sử trận
- danh sách trận đã chơi
- xem chi tiết từng trận
- xem breakdown tính tiền theo từng rule
- lọc theo module, rule set, thời gian, người chơi nếu cần

### 4. Tổng kết Kèo đấu
- tổng tiền thắng/thua theo người chơi trên toàn nhóm
- số trận đã chơi
- số lần top 1 trong nhóm
- số lần thua nhiều nhất
- có thể lọc theo thời gian
- có thể xem lịch sử biến động công nợ

### 5. Tổng kết Quỹ nhóm
- tổng số dư quỹ
- tổng tiền đã đóng vào quỹ theo người
- số tiền đang nợ quỹ theo người
- lịch sử tăng/giảm quỹ
- lịch sử các trận của module quỹ

### 6. Rule configuration
- trang quản lý rule set cơ bản
- chỉnh giá trị rule mặc định
- thêm/sửa rule đơn giản
- chưa cần UI quá phức tạp kiểu visual builder, nhưng backend/domain phải mở rộng được

## Non-functional requirements
- codebase rõ ràng, dễ maintain
- type-safe tốt
- validation cả client và server
- timezone rõ ràng
- handling tiền tệ bằng integer đơn vị VND, không dùng float
- có seed data để demo
- có test cho calculation engine
- responsive tốt, ưu tiên mobile-first
- thao tác nhập trận nhanh, ít click

## Kiến trúc mong muốn

Hãy đề xuất kiến trúc cụ thể, sau đó implement theo kiến trúc đó. Tôi ưu tiên một trong hai hướng sau, bạn chọn phương án tốt hơn và giải thích lý do trong proposal/design:

### Option A
- `apps/web`: React + Vite
- `apps/api`: API TypeScript chạy serverless/Vercel Functions
- `packages/shared`: shared types, validation, business rules

### Option B
- một app React-based triển khai full-stack theo cách phù hợp với Vercel
- vẫn phải tách riêng domain logic, data layer, API layer

Nếu chọn Option A, hãy ưu tiên monorepo pnpm.
Nếu chọn Option B, vẫn phải giữ code organization tốt.

## Database và migration
- dùng PostgreSQL
- migration tool rõ ràng
- seed script mẫu
- schema cần bao phủ đầy đủ MVP
- cần hỗ trợ lưu ledger cho công nợ và quỹ tách bạch

## API / app behavior
- tạo match phải trigger tính toán settlement ngay lúc tạo
- settlement result phải lưu xuống database
- có endpoint hoặc query để lấy leaderboard / summary của Kèo đấu
- có endpoint hoặc query để lấy match detail kèm breakdown
- có endpoint hoặc query để lấy fund summary, fund ledger, fund match history
- có endpoint hoặc query để lấy rule list/detail
- có endpoint hoặc query để lưu và đọc last-used preset cho form tạo trận nếu phù hợp kiến trúc

## UX tối thiểu
- dashboard đơn giản
- mobile-first
- trên mỗi module có nút `+` để thêm trận nhanh
- form nhập trận nhanh
- ghi nhớ người chơi/rule gần nhất khi tạo trận
- bảng lịch sử rõ ràng
- bảng leaderboard/công nợ rõ ràng
- bảng quỹ rõ ràng
- responsive ở mức tốt
- note của trận hiển thị dễ thấy trong màn hình chi tiết

## Điều tôi muốn từ OpenSpec workflow

Hãy tạo đầy đủ:
- `proposal.md`
- `design.md`
- `tasks.md`
- specs delta cho các capability cần thiết

Trong proposal/design/tasks, hãy:
- nêu rõ tech stack cuối cùng
- giải thích vì sao chọn database/backend đó
- mô tả data model
- mô tả calculation engine
- mô tả cách tách `Kèo đấu` và `Quỹ nhóm` thành 2 luồng kế toán riêng
- mô tả cách mở rộng rule trong tương lai
- mô tả cách lưu recent preset để tăng UX nhập trận
- mô tả chiến lược mobile-first UI
- chia task thành các bước nhỏ có thể thực thi dần

## Điều tôi muốn Codex làm tiếp sau propose
Sau khi hoàn tất propose, nếu mọi thứ rõ ràng, tôi sẽ chạy apply để implement.
Vì vậy hãy viết artifacts đủ cụ thể để apply có thể đi tiếp mượt.

## Ưu tiên kỹ thuật của tôi
- dễ làm trước, tối ưu sau
- free tier thân thiện
- deploy FE trên Vercel
- code sạch, dễ mở rộng
- ưu tiên dùng PostgreSQL
- ưu tiên mobile-first UX

## Gợi ý thiết kế rule engine
Tôi muốn engine không hard-code toàn bộ rule vào if/else rải rác. Hãy gom logic vào domain service rõ ràng, ví dụ:
- base settlement rule theo số lượng người chơi và module
- bonus/penalty rule theo placement cụ thể
- fund contribution rule cho module quỹ
- evaluation pipeline để áp dụng nhiều rule lên cùng một match
- lưu được breakdown từng rule áp dụng cho từng người chơi
- có abstraction cho source/destination account của từng settlement line

## Acceptance criteria mức đầu
- có thể tạo người chơi
- có thể tạo trận 3 người hoặc 4 người
- có thể chọn module `Kèo đấu` hoặc `Quỹ nhóm`
- có thể nhập hạng TFT cho từng người
- có thể chọn rule set khi tạo trận
- hệ thống tính đúng tiền theo rule hiện tại của Kèo đấu
- hệ thống tính đúng contribution vào quỹ theo rule hiện tại của Quỹ nhóm
- có thể chỉnh các giá trị rule cơ bản mà không cần sửa code logic chính
- có dashboard/tổng kết cho Kèo đấu
- có dashboard/tổng kết cho Quỹ nhóm
- có lịch sử trận và chi tiết trận
- có note cho trận
- lần tạo trận tiếp theo nhớ người chơi/rule gần nhất
- có seed data và test cho case 3 người, 4 người, top1-top2 penalty, top8 penalty, quỹ nhóm cơ bản

## Yêu cầu output
1. Tạo OpenSpec change hoàn chỉnh
2. Đặt tên change rõ ràng, ví dụ `add-lolchess-history-manager`
3. Viết spec đủ chi tiết để sau đó implement được ngay
4. Nếu có chỗ cần assumption hợp lý thì tự quyết và ghi rõ trong proposal/design
5. Ưu tiên thiết kế để sau này dễ thêm luật mới và thay đổi mức tiền

## Lưu ý quan trọng
- Nếu thấy requirement có chỗ mơ hồ, hãy tự chọn assumption hợp lý để workflow đi tiếp, nhưng phải ghi rõ assumption
- Hãy tối ưu proposal/design theo hướng side project nhỏ nhưng có nền tảng tốt để mở rộng
- Hãy ưu tiên mobile-first UX vì app này sẽ thường được mở trên điện thoại ngay sau khi chơi xong trận
