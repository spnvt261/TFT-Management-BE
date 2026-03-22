## ADDED Requirements

### Requirement: Backend codebase MUST enforce modular layering
The backend SHALL organize code into module boundaries (`system`, `players`, `rules`, `matches`, `match-stakes`, `group-fund`, `presets`, `ledger`) and shared layers (`core`, `db`, `domain`, `lib`) under a backend-first root such as `apps/api` or `backend`.

#### Scenario: Module structure review
- **WHEN** a new backend contributor inspects the repository structure
- **THEN** they can identify module-specific folders and shared layers with clear responsibilities

### Requirement: Controllers MUST remain thin and delegate business logic
Route handlers/controllers SHALL handle transport concerns only (validation, auth/context, response mapping). Business calculations and accounting decisions MUST be delegated to services/domain layer.

#### Scenario: Match creation endpoint implementation
- **WHEN** `POST /api/v1/matches` is invoked
- **THEN** the controller validates input and delegates settlement calculation to domain/service components instead of embedding rule `if/else` logic

### Requirement: Rule calculation logic MUST be centralized in domain services
Rule evaluation, settlement line generation, and ledger posting planning SHALL be implemented in centralized domain services shared by relevant modules.

#### Scenario: Adding new rule action type
- **WHEN** developers add a new rule action behavior
- **THEN** they extend domain rule-engine services without duplicating logic across multiple route handlers

### Requirement: DTOs MUST be strongly typed with explicit validation
All API request DTOs SHALL be strongly typed and validated explicitly before service execution.

#### Scenario: Invalid API payload
- **WHEN** a client sends an invalid payload (for example duplicate participants in match creation)
- **THEN** the API rejects the request with a validation error and does not invoke persistence logic