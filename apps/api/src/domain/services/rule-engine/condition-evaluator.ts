import type { MatchRuleContext, MatchParticipantContext } from "../../../db/repositories/account-resolution-helper.js";

export interface ConditionRecord {
  conditionKey: string;
  operator: string;
  valueJson: unknown;
}

function compare(operator: string, left: unknown, right: unknown): boolean {
  switch (operator) {
    case "EQ":
      return left === right;
    case "NEQ":
      return left !== right;
    case "GT":
      return Number(left) > Number(right);
    case "GTE":
      return Number(left) >= Number(right);
    case "LT":
      return Number(left) < Number(right);
    case "LTE":
      return Number(left) <= Number(right);
    case "IN":
      return Array.isArray(right) && right.includes(left);
    case "NOT_IN":
      return Array.isArray(right) && !right.includes(left);
    case "CONTAINS":
      return Array.isArray(left) && Array.isArray(right) ? right.every((item) => left.includes(item)) : false;
    case "BETWEEN": {
      if (!Array.isArray(right) || right.length !== 2) {
        return false;
      }
      const value = Number(left);
      return value >= Number(right[0]) && value <= Number(right[1]);
    }
    default:
      return false;
  }
}

function conditionValue(
  context: MatchRuleContext,
  conditionKey: string,
  subject: MatchParticipantContext | null
): unknown {
  switch (conditionKey) {
    case "participantCount":
      return context.participantCount;
    case "module":
      return context.module;
    case "subjectRelativeRank":
      return subject?.relativeRank ?? null;
    case "subjectAbsolutePlacement":
      return subject?.tftPlacement ?? null;
    case "matchContainsAbsolutePlacements":
      return context.participants.map((participant) => participant.tftPlacement);
    default:
      return null;
  }
}

export function hasSubjectScopedCondition(conditions: ConditionRecord[]): boolean {
  return conditions.some((item) => item.conditionKey === "subjectRelativeRank" || item.conditionKey === "subjectAbsolutePlacement");
}

export function evaluateConditions(
  context: MatchRuleContext,
  conditions: ConditionRecord[],
  subject: MatchParticipantContext | null
): boolean {
  return conditions.every((condition) => {
    const left = conditionValue(context, condition.conditionKey, subject);
    const right = condition.valueJson;
    return compare(condition.operator, left, right);
  });
}
