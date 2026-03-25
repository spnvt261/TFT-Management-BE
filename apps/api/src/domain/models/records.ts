import type { DebtPeriodStatus, ModuleType } from "./enums.js";

export interface GroupRecord {
  id: string;
  code: string;
  name: string;
  timezone: string;
  currencyCode: string;
}

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRecord {
  id: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleSetRecord {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleConditionRecord {
  id: string;
  conditionKey: string;
  operator: string;
  valueJson: unknown;
  sortOrder: number;
}

export interface RuleActionRecord {
  id: string;
  actionType: string;
  amountVnd: number;
  sourceSelectorType: string;
  sourceSelectorJson: unknown;
  destinationSelectorType: string;
  destinationSelectorJson: unknown;
  descriptionTemplate: string | null;
  sortOrder: number;
}

export interface RuleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ruleKind: string;
  priority: number;
  status: string;
  stopProcessingOnMatch: boolean;
  metadata: unknown;
  conditions: RuleConditionRecord[];
  actions: RuleActionRecord[];
}

export interface RuleSetVersionRecord {
  id: string;
  ruleSetId: string;
  versionNo: number;
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown;
  builderType: string | null;
  builderConfig: unknown | null;
  createdAt: string;
  rules: RuleRecord[];
}

export interface SettlementLineDraft {
  ruleId: string | null;
  ruleCode: string;
  ruleName: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourcePlayerId: string | null;
  destinationPlayerId: string | null;
  amountVnd: number;
  reasonText: string;
  metadataJson: unknown;
}

export interface LedgerEntryDraft {
  sourceAccountId: string;
  destinationAccountId: string;
  amountVnd: number;
  reasonText: string;
  lineNo: number;
}

export interface MatchStakesDebtPeriodRecord {
  id: string;
  groupId: string;
  periodNo: number;
  title: string | null;
  note: string | null;
  closeNote: string | null;
  closingSnapshotJson: unknown | null;
  nextPeriodId: string | null;
  status: DebtPeriodStatus;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
