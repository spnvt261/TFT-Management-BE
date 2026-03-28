import type { Queryable } from "../postgres/transaction.js";
import { GroupRepository } from "./group-repository.js";
import { PlayerRepository } from "./player-repository.js";
import { RuleRepository } from "./rule-repository.js";
import { MatchRepository } from "./match-repository.js";
import { SettlementRepository } from "./settlement-repository.js";
import { LedgerRepository } from "./ledger-repository.js";
import { PresetRepository } from "./preset-repository.js";
import { AuditRepository } from "./audit-repository.js";
import { AccountRepository } from "./account-repository.js";
import { MatchStakesDebtRepository } from "./match-stakes-debt-repository.js";
import { RoleRepository } from "./role-repository.js";
import { HistoryEventRepository } from "./history-event-repository.js";

export function createRepositories(db: Queryable) {
  return {
    groups: new GroupRepository(db),
    roles: new RoleRepository(db),
    players: new PlayerRepository(db),
    rules: new RuleRepository(db),
    matches: new MatchRepository(db),
    settlements: new SettlementRepository(db),
    ledgers: new LedgerRepository(db),
    presets: new PresetRepository(db),
    audits: new AuditRepository(db),
    accounts: new AccountRepository(db),
    matchStakesDebt: new MatchStakesDebtRepository(db),
    historyEvents: new HistoryEventRepository(db)
  };
}

export type RepositoryBundle = ReturnType<typeof createRepositories>;
