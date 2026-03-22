## ADDED Requirements

### Requirement: Match creation API MUST enforce domain input invariants
`POST /api/v1/matches` SHALL validate module, played time, rule set context, and participant constraints. Participant count MUST be exactly 3 or 4, player IDs MUST be unique, and TFT placements MUST be unique within 1..8.

#### Scenario: Duplicate placement in participants
- **WHEN** a match creation payload contains duplicate `tftPlacement` values
- **THEN** the backend rejects the request and persists no match data

### Requirement: Match creation MUST trigger immediate settlement and posting flow
After a valid match is persisted, the backend SHALL immediately calculate settlement, create settlement lines, create ledger posting batch/entries, and store calculation snapshots in the same transactional workflow.

#### Scenario: Successful match creation
- **WHEN** a valid match creation request is submitted
- **THEN** the backend returns match detail with participants and settlement breakdown derived from applied rules

### Requirement: Rule evaluation pipeline MUST support base and modifier composition
Settlement calculation SHALL execute a rule pipeline that supports base settlement rules, modifier rules, and fund contribution rules, including multiple rules applied to one match.

#### Scenario: Match with base and modifier rules
- **WHEN** a match context satisfies both base payout rules and top8 modifier rule
- **THEN** settlement output includes line items for both rule categories with rule-by-rule references

### Requirement: Match persistence MUST store exact rule version and snapshots
The backend SHALL persist `rule_set_version_id` used for calculation and store rule/result snapshots for audit and reproducibility.

#### Scenario: Historical match re-read
- **WHEN** clients fetch `GET /api/v1/matches/:matchId`
- **THEN** the response can show which exact rule set version and settlement breakdown were used at calculation time

### Requirement: Match void MUST preserve accounting history via reversal strategy
`POST /api/v1/matches/:matchId/void` SHALL mark the match as voided and preserve accounting history by reversal posting or equivalent non-destructive strategy.

#### Scenario: Void a posted match
- **WHEN** a previously posted match is voided
- **THEN** the backend records void metadata and reversal effects without deleting original ledger history