import { z } from "zod";

export const ruleBuilderTypeValues = ["MATCH_STAKES_PAYOUT"] as const;
export type RuleBuilderType = (typeof ruleBuilderTypeValues)[number];

export const ruleBuilderTypeSchema = z.enum(ruleBuilderTypeValues);

export const matchStakesPenaltyDestinationSelectorTypeValues = [
  "BEST_PARTICIPANT",
  "MATCH_WINNER",
  "FIXED_PLAYER",
  "FUND_ACCOUNT"
] as const;

export type MatchStakesPenaltyDestinationSelectorType =
  (typeof matchStakesPenaltyDestinationSelectorTypeValues)[number];

export const matchStakesPenaltyDestinationSelectorTypeSchema = z.enum(
  matchStakesPenaltyDestinationSelectorTypeValues
);

export const matchStakesPayoutLossEntryInputSchema = z.object({
  relativeRank: z.coerce.number().int(),
  amountVnd: z.coerce.number().int()
});

export const matchStakesPenaltyConfigInputSchema = z.object({
  absolutePlacement: z.coerce.number().int(),
  amountVnd: z.coerce.number().int(),
  destinationSelectorType: matchStakesPenaltyDestinationSelectorTypeSchema.optional(),
  destinationSelectorJson: z.record(z.string(), z.unknown()).nullable().optional(),
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(150).optional(),
  description: z.string().nullable().optional()
});

export const matchStakesBuilderConfigInputSchema = z.object({
  participantCount: z.coerce.number().int(),
  winnerCount: z.coerce.number().int(),
  payouts: z.array(matchStakesPayoutLossEntryInputSchema),
  losses: z.array(matchStakesPayoutLossEntryInputSchema),
  penalties: z.array(matchStakesPenaltyConfigInputSchema).optional()
});

export type MatchStakesBuilderConfigInput = z.infer<typeof matchStakesBuilderConfigInputSchema>;

export interface MatchStakesPayoutLossEntry {
  relativeRank: number;
  amountVnd: number;
}

export interface MatchStakesPenaltyConfig {
  absolutePlacement: number;
  amountVnd: number;
  destinationSelectorType: MatchStakesPenaltyDestinationSelectorType;
  destinationSelectorJson: Record<string, unknown> | null;
  code?: string;
  name?: string;
  description?: string | null;
}

export interface MatchStakesBuilderConfig {
  participantCount: 3 | 4;
  winnerCount: number;
  payouts: MatchStakesPayoutLossEntry[];
  losses: MatchStakesPayoutLossEntry[];
  penalties: MatchStakesPenaltyConfig[];
}

export interface RuleVersionRuleInput {
  code: string;
  name: string;
  description: string | null;
  ruleKind: string;
  priority: number;
  status: string;
  stopProcessingOnMatch: boolean;
  metadata: unknown;
  conditions: Array<{ conditionKey: string; operator: string; valueJson: unknown; sortOrder: number }>;
  actions: Array<{
    actionType: string;
    amountVnd: number;
    sourceSelectorType: string;
    sourceSelectorJson: unknown;
    destinationSelectorType: string;
    destinationSelectorJson: unknown;
    descriptionTemplate: string | null;
    sortOrder: number;
  }>;
}

export interface CreateRuleSetVersionRequest {
  description: string | null;
  participantCountMin: number;
  participantCountMax: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  summaryJson: unknown;
  builderType?: RuleBuilderType | null;
  builderConfig?: unknown | null;
  rules?: RuleVersionRuleInput[];
}

export interface EditRuleSetVersionRequest {
  description?: string | null;
  participantCountMin?: number;
  participantCountMax?: number;
  effectiveTo?: string | null;
  isActive?: boolean;
  summaryJson?: unknown;
  builderType?: RuleBuilderType | null;
  builderConfig?: unknown | null;
  rules?: RuleVersionRuleInput[];
}
