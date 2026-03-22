## ADDED Requirements

### Requirement: Player APIs SHALL support CRUD-style management for MVP
The backend SHALL provide player APIs to list, create, get detail, update, and deactivate players.

#### Scenario: Deactivate existing player
- **WHEN** a client calls `DELETE /api/v1/players/:playerId`
- **THEN** the player is soft-deactivated and historical matches remain intact

### Requirement: Health endpoint SHALL provide service liveness
The backend SHALL expose `GET /api/v1/health` returning a typed liveness payload suitable for local and deployment health checks.

#### Scenario: Health check request
- **WHEN** a client calls `/api/v1/health`
- **THEN** the API returns an `ok` service status payload with timestamp metadata

### Requirement: Recent match preset APIs MUST store per-module quick-entry state
The backend SHALL provide APIs to fetch and upsert recent match presets by module (`MATCH_STAKES` and `GROUP_FUND`) including last-selected players and rule context.

#### Scenario: Fetch recent preset for module
- **WHEN** a client calls `GET /api/v1/recent-match-presets/:module`
- **THEN** the API returns the latest stored preset for that module or an empty default structure

### Requirement: Match creation flow MUST update recent preset automatically
On successful match creation, the backend SHALL upsert the recent preset record for that module using submitted participant and rule selection context.

#### Scenario: Create match then open quick entry
- **WHEN** a new match is created successfully for `GROUP_FUND`
- **THEN** subsequent preset fetch for `GROUP_FUND` returns the new last-used participant and rule selection