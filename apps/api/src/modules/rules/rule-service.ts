import { badRequest, notFound } from "../../core/errors/app-error.js";
import type { ModuleType } from "../../domain/models/enums.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";

export class RuleService {
  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

  public listRuleSets(input: {
    module?: ModuleType;
    status?: "ACTIVE" | "INACTIVE";
    isDefault?: boolean;
    page: number;
    pageSize: number;
  }) {
    return this.repositories.rules.listRuleSets({
      groupId: this.groupId,
      module: input.module,
      status: input.status,
      isDefault: input.isDefault,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  public createRuleSet(input: {
    module: ModuleType;
    code: string;
    name: string;
    description: string | null;
    status: "ACTIVE" | "INACTIVE";
    isDefault: boolean;
  }) {
    return this.repositories.rules.createRuleSet({
      groupId: this.groupId,
      module: input.module,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status,
      isDefault: input.isDefault
    });
  }

  public async getRuleSet(ruleSetId: string) {
    const ruleSet = await this.repositories.rules.getRuleSetById(this.groupId, ruleSetId);
    if (!ruleSet) {
      throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
    }

    const versions = await this.repositories.rules.listRuleSetVersions(ruleSetId);
    return { ...ruleSet, versions };
  }

  public async updateRuleSet(
    ruleSetId: string,
    input: { name?: string; description?: string | null; status?: "ACTIVE" | "INACTIVE"; isDefault?: boolean }
  ) {
    const ruleSet = await this.repositories.rules.updateRuleSet(this.groupId, ruleSetId, input);
    if (!ruleSet) {
      throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
    }
    return ruleSet;
  }

  public async createVersion(
    ruleSetId: string,
    input: {
      participantCountMin: number;
      participantCountMax: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      isActive: boolean;
      summaryJson: unknown;
      rules: Array<{
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
      }>;
    }
  ) {
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

    return this.repositories.rules.createRuleSetVersion({
      ruleSetId,
      participantCountMin: input.participantCountMin,
      participantCountMax: input.participantCountMax,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      isActive: input.isActive,
      summaryJson: input.summaryJson,
      rules: input.rules
    });
  }

  public async getVersion(ruleSetId: string, versionId: string) {
    const version = await this.repositories.rules.getRuleSetVersionDetail(ruleSetId, versionId);
    if (!version) {
      throw notFound("RULE_SET_VERSION_NOT_FOUND", "Rule set version not found");
    }
    return version;
  }

  public async updateVersion(
    ruleSetId: string,
    versionId: string,
    input: { isActive?: boolean; effectiveFrom?: string; effectiveTo?: string | null; summaryJson?: unknown }
  ) {
    const version = await this.repositories.rules.updateRuleSetVersion(ruleSetId, versionId, input);
    if (!version) {
      throw notFound("RULE_SET_VERSION_NOT_FOUND", "Rule set version not found");
    }
    return version;
  }

  public async getDefaultByModule(module: ModuleType, participantCount?: number) {
    const ruleSet = await this.repositories.rules.getDefaultRuleSetByModule(this.groupId, module);
    if (!ruleSet) {
      throw notFound("RULE_SET_DEFAULT_NOT_FOUND", `No default rule set found for module ${module}`);
    }

    if (participantCount === undefined) {
      return { ruleSet, activeVersion: null };
    }

    const now = new Date().toISOString();
    const activeVersion = await this.repositories.rules.resolveVersionForMatch({
      ruleSetId: ruleSet.id,
      module,
      participantCount,
      playedAt: now
    });

    return { ruleSet, activeVersion };
  }
}
