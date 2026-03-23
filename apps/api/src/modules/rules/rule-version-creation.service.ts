import { badRequest, notFound } from "../../core/errors/app-error.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";
import type { ModuleType } from "../../domain/models/enums.js";
import { MatchStakesBuilderValidationService } from "./match-stakes-builder-validation.service.js";
import { MatchStakesBuilderCompileService } from "./match-stakes-builder-compile.service.js";
import type { CreateRuleSetVersionRequest, RuleBuilderType } from "./builder-types.js";

function hasBuilderMode(builderType?: RuleBuilderType | null, builderConfig?: unknown | null): boolean {
  return (
    (builderType !== undefined && builderType !== null) ||
    (builderConfig !== undefined && builderConfig !== null)
  );
}

export class RuleVersionCreationService {
  private readonly builderValidationService = new MatchStakesBuilderValidationService();

  private readonly builderCompileService = new MatchStakesBuilderCompileService();

  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

  public async create(ruleSetId: string, input: CreateRuleSetVersionRequest) {
    const ruleSet = await this.repositories.rules.getRuleSetById(this.groupId, ruleSetId);
    if (!ruleSet) {
      throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
    }

    if (input.participantCountMin > input.participantCountMax) {
      throw badRequest(
        "RULE_SET_VERSION_INVALID",
        "participantCountMin must be less than or equal to participantCountMax"
      );
    }

    const requestedBuilderMode = hasBuilderMode(input.builderType, input.builderConfig);
    const hasRawRules = Array.isArray(input.rules);

    if (requestedBuilderMode) {
      if (hasRawRules) {
        throw badRequest(
          "RULE_BUILDER_INVALID_CONFIG",
          "Cannot provide both builder mode fields and raw rules in the same request"
        );
      }

      if (!input.builderType || input.builderConfig === null || input.builderConfig === undefined) {
        throw badRequest(
          "RULE_BUILDER_INVALID_CONFIG",
          "builderType and builderConfig are both required in builder mode"
        );
      }

      const normalizedBuilderConfig = this.validateBuilderConfig(ruleSet.module, input, input.builderConfig);
      const compiledRules = this.builderCompileService.compile(normalizedBuilderConfig);

      return this.repositories.rules.createRuleSetVersion({
        ruleSetId,
        description: input.description,
        participantCountMin: input.participantCountMin,
        participantCountMax: input.participantCountMax,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        isActive: input.isActive,
        summaryJson: input.summaryJson,
        builderType: input.builderType,
        builderConfig: normalizedBuilderConfig,
        rules: compiledRules
      });
    }

    if (!hasRawRules || (input.rules?.length ?? 0) === 0) {
      throw badRequest(
        "RULE_SET_VERSION_INVALID",
        "rules is required when builder mode is not used"
      );
    }

    const rawRules = input.rules;
    if (!rawRules) {
      throw badRequest(
        "RULE_SET_VERSION_INVALID",
        "rules is required when builder mode is not used"
      );
    }

    return this.repositories.rules.createRuleSetVersion({
      ruleSetId,
      description: input.description,
      participantCountMin: input.participantCountMin,
      participantCountMax: input.participantCountMax,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isActive: input.isActive,
      summaryJson: input.summaryJson,
      builderType: null,
      builderConfig: null,
      rules: rawRules
    });
  }

  private validateBuilderConfig(module: ModuleType, input: CreateRuleSetVersionRequest, builderConfig: unknown) {
    switch (input.builderType) {
      case "MATCH_STAKES_PAYOUT":
        return this.builderValidationService.validate({
          module,
          participantCountMin: input.participantCountMin,
          participantCountMax: input.participantCountMax,
          builderConfig
        });
      default:
        throw badRequest("RULE_BUILDER_INVALID_CONFIG", `Unsupported builderType: ${input.builderType}`);
    }
  }
}
