# OpenSpec Prompt - LolChessTFT History Manager (Revised Business v2)

Use this prompt in Codex after you have run `openspec init --tools codex`.

## Recommended command

```text
$openspec-propose
```

Then paste the full content below.

---

I want to build a web app to manage the history of LolChess TFT games for a group of friends.

## Product goals

Build a **mobile-first** web application to:
- store the match history of a TFT friend group
- enter match results very quickly on mobile
- automatically calculate money based on a configurable rule set
- manage both **player-vs-player debt** and the **group fund** in parallel
- view summary dashboards, match history, money movement history, and fund history
- make rules easy to extend in the future without scattered if/else logic

## Revised business structure

I want the system to be organized into **3 main modules**:

1. **Match Stakes**
   - this module is for direct money play between players
   - winners receive money, losers pay money based on the selected rule set
   - this is where the app shows the **overall group debt state**

2. **Group Fund**
   - this module has no direct winner
   - money is added to or deducted from the group fund based on the selected rule set
   - this is where the app shows the **fund balance** and **how much each player owes the fund**

3. **Rules**
   - manage all rule sets and detailed rules
   - needs screens for: rule list, rule detail, add rule, edit rule

> Please use module names consistent with the spirit above. If needed, proposal/design may refine UI naming, but by default I want these names: **Match Stakes**, **Group Fund**, **Rules**.

## Technical direction

Please design and implement this in a production-ready way, but optimized for a small side project with low cost.

### Frontend
- React + TypeScript
- prefer Vite
- UI should prioritize Tailwind CSS + shadcn/ui or a suitable library
- mobile-first, fast interactions on small screens
- forms can use React Hook Form + Zod when helpful
- data fetching/caching can use TanStack Query
- charts can use Recharts
- UX should support rapid repeated match entry

### Backend
- TypeScript
- prefer a simple API, easy to deploy, without a dedicated server unless necessary
- recommend Vercel Functions or a Vercel-compatible architecture
- calculation domain logic must be clearly separated from controller/API layers
- need a flexible rule engine or calculation engine so future rule changes do not require many edits

### Database
- PostgreSQL
- designed for long-term storage
- prefer free tier or near-free tier options
- clear migrations required
- prefer ORM / type-safe query layer such as Drizzle ORM

## Core business requirements

### General context
- a group of friends regularly plays TFT
- in one TFT game, there are 8 placements from 1 to 8
- the friend group has at least 3 players, usually 3 or 4
- when entering a match, the app must store each player’s actual TFT placement in that game
- each match belongs to exactly **1 module**: `Match Stakes` or `Group Fund`
- when creating a match, the user must **choose the rule set** applied to that match
- each match may include a **note**

### UX requirements for match creation
- when opening the match creation form, the system must **remember the last created match**
- it should remember at least:
  - which players were selected last time
  - which rule set was selected last time
  - which module was selected last time, when appropriate
- the user can still modify everything before saving
- on both the `Match Stakes` and `Group Fund` screens, there should be a clear `+` button to open quick match entry

## Module 1 business rules: Match Stakes

This is the money-play flow between players.

### General rules
- this is where the app always shows **debt across the full friend group**, not only a single match or the last participating subgroup
- the system must store a detailed enough ledger to calculate:
  - total profit/loss by player
  - debt movement history
  - history of matches that belong to the Match Stakes module
  - a breakdown of why each player gained or lost a given amount

### Current default rules for Match Stakes

#### When there are 3 players
- the player with the best TFT placement among participants is the winner
- the other 2 players are losers
- default:
  - winner: **+100,000 VND**
  - 2 losers: **-50,000 VND each**
- these values must be configurable, not hard-coded

#### When there are 4 players
- the player with the best TFT placement among participants: **+70,000 VND**
- the player with the second-best placement among participants: **+30,000 VND**
- the other 2 players: **-50,000 VND each**
- these values must be configurable, not hard-coded

### Special rules in Match Stakes
- if among the participants there is 1 player who placed **top 1** in TFT and another player who placed **top 2** in TFT, then the top 2 player pays an additional **10,000 VND** penalty
- the player who placed **top 8** always pays an additional **10,000 VND** penalty
- these special rules must also be configurable

### Assumption that must be stated clearly in proposal/design
Since the requirement does not specify **where penalty money goes**, please design the engine so **each rule can configure its source and destination account explicitly**.

For MVP, use these default assumptions and state them clearly in proposal/design:
- `top1-top2 penalty`: the top 2 player pays an additional 10,000 VND to the top 1 player of that match
- `top8 penalty`: the top 8 player pays an additional 10,000 VND to the player with the best placement among the participants in that match

But the architecture must be open enough to later change the destination to:
- the match winner
- the group fund
- another intermediate account

### Match Stakes screen
Top section:
- show **overall group debt**
- prioritize an easy-to-understand mobile layout
- it may show net balance by player and/or suggestions for who owes whom

Bottom section should have a switch/tab to choose between:
1. **Debt movement history**
   - example: datetime, player, movement `-30,000`, `+20,000`, reason
2. **Match Stakes match history**
   - example: datetime, placements, applied rule, note, total settlement

## Module 2 business rules: Group Fund

This flow has no direct winner. Money is moved into or out of the fund based on rules.

### General rules
- each match in the `Group Fund` module uses 1 rule set appropriate for that module
- the match settlement impacts the **fund ledger** instead of player-vs-player debt
- the system must track:
  - current fund balance
  - total money each player has contributed to the fund
  - how much each player currently owes the fund, if any
  - fund increase/decrease history
  - history of matches belonging to the Group Fund module

### First example default rule for Group Fund
This is only a starting example and must be configurable:

#### When there are 3 players
- there is no direct winner
- the 2 players with lower placement among participants contribute money to the fund
- example defaults:
  - the player ranked 2nd among participants contributes **X**
  - the player ranked 3rd among participants contributes **Y**
- X and Y are configurable

> Please design this in a general way so that future rules for 4-player matches or other fund rules can be added without rewriting the engine.

### Group Fund screen
Top section:
- show **current fund balance**
- show **how much each player owes the fund**
- if appropriate, also show how much each player has contributed in total

Bottom section should have a switch/tab to choose between:
1. **Fund increase/decrease history**
   - clear ledger: datetime, related player, amount, movement type, reason, link to match if caused by a match
2. **Group Fund match history**
   - datetime, players, placements, rule set, note, settlement into the fund

## Rules module

I want a complete enough rule management screen for a basic MVP:
- rule set list
- rule set detail
- add rule set
- edit rule set
- enable/disable rules
- configure money values without changing the core logic code

The rule system must support at least these concepts:
- applicable module: `Match Stakes` or `Group Fund`
- applicable participant count: 3 or 4, with room to extend later
- base payout/contribution rule by relative placement among participants
- modifier rule by absolute TFT placement (for example top1/top2/top8)
- source/destination account of each settlement line
- active/inactive
- effective time or versioning if appropriate

## Domain model requirements

Please design the model well enough for future expansion, for example:
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
- DebtLedger or PlayerLedger
- FundLedger
- FundBalanceSnapshot if needed
- AuditLog if needed
- UserPreference or RecentMatchPreset if needed for remembering last entry UX

Please consider storing:
- rule snapshot at match calculation time
- detailed calculation result per player in the match
- auditability: later it should be possible to see why a player was credited/debited a specific amount
- match module (`Match Stakes` or `Group Fund`)
- match note
- preset / last-used selection for the match creation form

## MVP features

### 1. Player management
- add/edit/delete players
- active/inactive
- can be attached to a primary group

### 2. Match creation
- create a match under `Match Stakes` or `Group Fund`
- choose date/time
- choose 3 or 4 players
- enter each player’s TFT placement from 1 to 8
- validate that placements are unique within the same match
- choose the rule set applied to the match
- enter a note if needed
- automatically calculate settlement after saving
- the next creation should remember the most recent players/rule to improve UX

### 3. Match history
- list of played matches
- view match detail
- view money calculation breakdown by rule
- filter by module, rule set, time, player if needed

### 4. Match Stakes summary
- total money won/lost per player across the whole group
- total number of matches played
- number of times ranked first among participants
- number of times losing the most
- can filter by time
- can view debt movement history

### 5. Group Fund summary
- total fund balance
- total contribution into the fund by player
- amount currently owed to the fund by player
- fund increase/decrease history
- match history for the fund module

### 6. Rule configuration
- basic rule set management page
- edit default rule values
- add/edit simple rules
- UI does not need to be a full visual rule builder yet, but backend/domain must remain extensible

## Non-functional requirements
- clear, maintainable codebase
- strong type safety
- validation on both client and server
- explicit timezone handling
- money handling must use integer VND units, never float
- seed data for demo
- tests for the calculation engine
- strong responsive design with mobile-first priority
- fast, low-click match entry

## Preferred architecture

Please propose a concrete architecture, then implement according to that architecture. I prefer one of these two directions; choose the better option and explain the reason in the proposal/design:

### Option A
- `apps/web`: React + Vite
- `apps/api`: TypeScript API running as serverless / Vercel Functions
- `packages/shared`: shared types, validation, business rules

### Option B
- a single React-based app implemented full-stack in a way that fits Vercel
- domain logic, data layer, and API layer must still be separated clearly

If choosing Option A, prefer a pnpm monorepo.
If choosing Option B, still keep code organization clean.

## Database and migration
- use PostgreSQL
- clear migration tooling
- sample seed script
- schema must cover the full MVP
- must support separate ledgers for debt and fund

## API / app behavior
- creating a match must trigger settlement calculation immediately
- settlement result must be persisted in the database
- need an endpoint or query for Match Stakes leaderboard / summary
- need an endpoint or query for match detail with breakdown
- need an endpoint or query for fund summary, fund ledger, and fund match history
- need an endpoint or query for rule list/detail
- need an endpoint or query to save and read the last-used preset for match creation if it fits the architecture

## Minimum UX
- simple dashboard
- mobile-first
- on each module screen there must be a `+` button for quick match creation
- quick match entry form
- remember recent players/rule on next creation
- clear history tables
- clear leaderboard / debt tables
- clear fund tables
- good responsive behavior
- match note should be easy to see on the match detail screen

## What I want from the OpenSpec workflow

Please generate all of the following:
- `proposal.md`
- `design.md`
- `tasks.md`
- spec deltas for the required capabilities

In proposal/design/tasks, please:
- state the final tech stack clearly
- explain why that database/backend is chosen
- describe the data model
- describe the calculation engine
- describe how `Match Stakes` and `Group Fund` are separated into two accounting flows
- describe how the rule system can be extended later
- describe how recent preset storage improves the match entry UX
- describe the mobile-first UI strategy
- break tasks into small incremental steps

## What I want Codex to do next after propose
After proposal is complete, if everything is clear, I will run apply to implement.
So please write the artifacts in enough detail that apply can continue smoothly.

## My technical priorities
- easy to build first, optimize later
- free-tier friendly
- deploy frontend on Vercel
- clean, extensible code
- prefer PostgreSQL
- prefer mobile-first UX

## Rule engine design hint
I do not want the engine to hard-code all rules in scattered if/else statements. Please centralize the logic into clear domain services, for example:
- base settlement rule by participant count and module
- bonus/penalty rule by specific placement
- fund contribution rule for the fund module
- evaluation pipeline to apply multiple rules to the same match
- store rule-by-rule breakdown for each player in a match
- have an abstraction for source/destination account of each settlement line

## Initial acceptance criteria
- can create players
- can create 3-player or 4-player matches
- can choose module `Match Stakes` or `Group Fund`
- can enter TFT placements for each player
- can choose a rule set when creating a match
- system correctly calculates money according to the current Match Stakes rules
- system correctly calculates fund contributions according to the current Group Fund rule
- can edit core rule values without changing the main logic code
- has dashboard/summary for Match Stakes
- has dashboard/summary for Group Fund
- has match history and match detail
- has notes for matches
- the next match creation remembers the most recent players/rule
- has seed data and tests for 3-player, 4-player, top1-top2 penalty, top8 penalty, and basic Group Fund cases

## Output requirements
1. Create a complete OpenSpec change
2. Use a clear change name, for example `add-lolchess-history-manager`
3. Write the spec in enough detail that implementation can start immediately afterward
4. If there are ambiguous requirements, make reasonable assumptions and state them clearly
5. Prioritize a design that makes future rule changes and new rules easy to add

## Important note
- If any requirement is ambiguous, make a reasonable assumption so the workflow can move forward, but state it clearly
- Please optimize proposal/design for a small side project with a solid foundation for expansion
- Please prioritize mobile-first UX because this app will usually be opened on a phone right after finishing a match