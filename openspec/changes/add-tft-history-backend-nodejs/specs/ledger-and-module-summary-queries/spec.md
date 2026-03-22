## ADDED Requirements

### Requirement: Accounting views MUST be separated by module semantics
The backend SHALL expose separate APIs and query logic for `MATCH_STAKES` and `GROUP_FUND` accounting semantics while sharing common ledger infrastructure.

#### Scenario: Module-isolated history query
- **WHEN** a client requests `GET /api/v1/match-stakes/matches`
- **THEN** only matches for `MATCH_STAKES` are returned

### Requirement: Match Stakes APIs SHALL provide summary and ledger/match history
The backend SHALL provide:
- `GET /api/v1/match-stakes/summary`
- `GET /api/v1/match-stakes/ledger`
- `GET /api/v1/match-stakes/matches`
These APIs MUST support filter parameters for date range and optional player context.

#### Scenario: Match Stakes summary request
- **WHEN** a client requests Match Stakes summary for a date range
- **THEN** the response includes per-player net state and aggregate match counts for that range

### Requirement: Group Fund APIs SHALL provide summary and ledger/match history
The backend SHALL provide:
- `GET /api/v1/group-fund/summary`
- `GET /api/v1/group-fund/ledger`
- `GET /api/v1/group-fund/matches`
These APIs MUST represent fund-balance and player-to-fund obligation perspectives.

#### Scenario: Group Fund summary request
- **WHEN** a client requests Group Fund summary
- **THEN** the response includes current fund balance and per-player contribution/obligation values

### Requirement: Ledger history endpoints MUST expose auditable movement metadata
Ledger history responses SHALL include posted timestamp, source/destination account context, amount, and rule reference metadata when available.

#### Scenario: Inspect ledger line provenance
- **WHEN** a client fetches ledger history for a module
- **THEN** each ledger item contains sufficient metadata to trace it back to settlement rule context or manual source type