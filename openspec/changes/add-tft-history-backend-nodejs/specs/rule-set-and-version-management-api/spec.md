## ADDED Requirements

### Requirement: Rule set management APIs SHALL support lifecycle operations
The backend SHALL provide REST APIs to list, create, view, and update rule sets, and to fetch a default rule set by module.

#### Scenario: Fetch default rule set by module
- **WHEN** a client requests `GET /api/v1/rule-sets/default/by-module/:module`
- **THEN** the API returns the default rule set and active version for that module, or an explicit not-found response if not configured

### Requirement: Rule set versions MUST be independently versioned and auditable
The backend SHALL support creating and retrieving rule set versions where each version stores its own rules, conditions, and actions. Existing versions MUST remain immutable for historical auditability.

#### Scenario: Create new rule set version
- **WHEN** a client calls `POST /api/v1/rule-sets/:ruleSetId/versions`
- **THEN** the backend creates a new incremented version record and persists its full rule graph without mutating prior version records

### Requirement: Version applicability MUST be validated by module, participant count, and effective window
When resolving a rule set version for a match, the backend MUST validate that the version belongs to the requested module context and is applicable by participant count and effective time.

#### Scenario: Version not applicable to participant count
- **WHEN** match creation references a version outside its participant count range
- **THEN** the request is rejected with a domain validation error and no match is persisted

### Requirement: Rule actions MUST explicitly define source and destination selectors
Rule action definitions SHALL include explicit source and destination selector/account semantics so penalty destinations are configurable and not globally hard-coded.

#### Scenario: Top1-top2 penalty configuration
- **WHEN** a default Match Stakes penalty rule is stored
- **THEN** the rule action records source as top2 selector and destination as top1 selector explicitly