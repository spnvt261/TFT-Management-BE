import { z } from "zod";

export const moduleTypeValues = ["MATCH_STAKES", "GROUP_FUND"] as const;
export type ModuleType = (typeof moduleTypeValues)[number];

export const matchStatusValues = ["DRAFT", "CALCULATED", "POSTED", "VOIDED"] as const;
export type MatchStatus = (typeof matchStatusValues)[number];

export const ruleStatusValues = ["ACTIVE", "INACTIVE"] as const;
export type RuleStatus = (typeof ruleStatusValues)[number];

export const ruleKindValues = [
  "BASE_RELATIVE_RANK",
  "ABSOLUTE_PLACEMENT_MODIFIER",
  "PAIR_CONDITION_MODIFIER",
  "FUND_CONTRIBUTION",
  "CUSTOM"
] as const;
export type RuleKind = (typeof ruleKindValues)[number];

export const conditionOperatorValues = ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN", "BETWEEN", "CONTAINS"] as const;
export type ConditionOperator = (typeof conditionOperatorValues)[number];

export const actionTypeValues = ["TRANSFER", "POST_TO_FUND", "CREATE_OBLIGATION", "REDUCE_OBLIGATION"] as const;
export type ActionType = (typeof actionTypeValues)[number];

export const selectorTypeValues = [
  "SUBJECT_PLAYER",
  "PLAYER_BY_RELATIVE_RANK",
  "PLAYER_BY_ABSOLUTE_PLACEMENT",
  "MATCH_WINNER",
  "MATCH_RUNNER_UP",
  "BEST_PARTICIPANT",
  "WORST_PARTICIPANT",
  "FUND_ACCOUNT",
  "SYSTEM_ACCOUNT",
  "FIXED_PLAYER"
] as const;
export type SelectorType = (typeof selectorTypeValues)[number];

export const accountTypeValues = ["PLAYER_DEBT", "FUND_MAIN", "PLAYER_FUND_OBLIGATION", "SYSTEM_HOLDING"] as const;
export type AccountType = (typeof accountTypeValues)[number];

export const debtPeriodStatusValues = ["OPEN", "CLOSED"] as const;
export type DebtPeriodStatus = (typeof debtPeriodStatusValues)[number];

export const moduleTypeSchema = z.enum(moduleTypeValues);
export const matchStatusSchema = z.enum(matchStatusValues);
export const ruleStatusSchema = z.enum(ruleStatusValues);
export const ruleKindSchema = z.enum(ruleKindValues);
export const conditionOperatorSchema = z.enum(conditionOperatorValues);
export const actionTypeSchema = z.enum(actionTypeValues);
export const selectorTypeSchema = z.enum(selectorTypeValues);
export const accountTypeSchema = z.enum(accountTypeValues);
export const debtPeriodStatusSchema = z.enum(debtPeriodStatusValues);
