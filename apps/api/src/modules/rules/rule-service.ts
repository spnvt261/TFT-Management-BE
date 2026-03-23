import { notFound } from "../../core/errors/app-error.js";
import type { ModuleType } from "../../domain/models/enums.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { RuleVersionCreationService } from "./rule-version-creation.service.js";
import type { CreateRuleSetVersionRequest } from "./builder-types.js";

export class RuleService {
  private readonly versionCreationService: RuleVersionCreationService;

  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {
    this.versionCreationService = new RuleVersionCreationService(repositories, groupId);
  }

  public listRuleSets(input: {
    modules?: ModuleType[];
    status?: "ACTIVE" | "INACTIVE";
    isDefault?: boolean;
    search?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }) {
    return this.repositories.rules.listRuleSets({
      groupId: this.groupId,
      modules: input.modules,
      status: input.status,
      isDefault: input.isDefault,
      search: input.search,
      from: input.from,
      to: input.to,
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

  public createVersion(ruleSetId: string, input: CreateRuleSetVersionRequest) {
    return this.versionCreationService.create(ruleSetId, input);
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
