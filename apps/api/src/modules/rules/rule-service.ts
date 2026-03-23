import type { Pool } from "pg";
import { AppError, badRequest, conflict, notFound } from "../../core/errors/app-error.js";
import { withTransaction } from "../../db/postgres/transaction.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
import type { ModuleType } from "../../domain/models/enums.js";
import { RuleVersionCreationService } from "./rule-version-creation.service.js";
import type { CreateRuleSetVersionRequest, EditRuleSetVersionRequest } from "./builder-types.js";

export class RuleService {
  public constructor(
    private readonly pool: Pool,
    private readonly repositories: RepositoryBundle,
    private readonly groupId: string
  ) {}

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

  public async createRule(input: {
    module: ModuleType;
    name: string;
    status: "ACTIVE" | "INACTIVE";
    isDefault: boolean;
    version: Omit<CreateRuleSetVersionRequest, "effectiveFrom">;
  }) {
    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const txVersionCreationService = new RuleVersionCreationService(txRepositories, this.groupId);

      const ruleSet = await this.createRuleSetWithGeneratedCode(txRepositories, {
        module: input.module,
        name: input.name,
        status: input.status,
        isDefault: input.isDefault
      });

      await txVersionCreationService.create(ruleSet.id, {
        ...input.version,
        effectiveFrom: new Date().toISOString()
      });

      return this.buildRuleSetDetail(txRepositories, ruleSet.id);
    });
  }

  public async getRuleSet(ruleSetId: string) {
    return this.buildRuleSetDetail(this.repositories, ruleSetId);
  }

  public async editRule(
    ruleSetId: string,
    input: {
      module?: ModuleType;
      code?: string;
      name?: string;
      status?: "ACTIVE" | "INACTIVE";
      isDefault?: boolean;
      version: EditRuleSetVersionRequest;
    }
  ) {
    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const txVersionCreationService = new RuleVersionCreationService(txRepositories, this.groupId);

      const existing = await txRepositories.rules.getRuleSetById(this.groupId, ruleSetId);
      if (!existing) {
        throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
      }

      if (input.module !== undefined && input.module !== existing.module) {
        throw badRequest("RULE_SET_MODULE_IMMUTABLE", "module cannot be changed when editing a rule");
      }

      if (input.code !== undefined && input.code !== existing.code) {
        throw badRequest("RULE_SET_CODE_IMMUTABLE", "code cannot be changed when editing a rule");
      }

      if (input.name !== undefined || input.status !== undefined || input.isDefault !== undefined) {
        const updated = await txRepositories.rules.updateRuleSet(this.groupId, ruleSetId, {
          name: input.name,
          status: input.status,
          isDefault: input.isDefault
        });
        if (!updated) {
          throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
        }
      }

      const versionSummaries = await txRepositories.rules.listRuleSetVersions(ruleSetId);
      const latestVersionId = versionSummaries[0]?.id;
      if (!latestVersionId) {
        throw notFound("RULE_SET_VERSION_NOT_FOUND", "Rule set version not found");
      }

      await txVersionCreationService.createFromExistingVersion(ruleSetId, latestVersionId, input.version);

      return this.buildRuleSetDetail(txRepositories, ruleSetId);
    });
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

  private async buildRuleSetDetail(repositories: RepositoryBundle, ruleSetId: string) {
    const ruleSet = await repositories.rules.getRuleSetById(this.groupId, ruleSetId);
    if (!ruleSet) {
      throw notFound("RULE_SET_NOT_FOUND", "Rule set not found");
    }

    const versionSummaries = await repositories.rules.listRuleSetVersions(ruleSetId);
    const versions = (
      await Promise.all(versionSummaries.map((version) => repositories.rules.getRuleSetVersionDetail(ruleSetId, version.id)))
    ).filter((version): version is NonNullable<typeof version> => version !== null);

    return {
      ...ruleSet,
      latestVersion: versions[0] ?? null,
      versions
    };
  }

  private async createRuleSetWithGeneratedCode(
    repositories: RepositoryBundle,
    input: {
      module: ModuleType;
      name: string;
      status: "ACTIVE" | "INACTIVE";
      isDefault: boolean;
    }
  ) {
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const code = this.generateRuleSetCode();
      try {
        return await repositories.rules.createRuleSet({
          groupId: this.groupId,
          module: input.module,
          code,
          name: input.name,
          status: input.status,
          isDefault: input.isDefault
        });
      } catch (error: unknown) {
        if (error instanceof AppError && error.code === "RULE_SET_DUPLICATE") {
          continue;
        }
        throw error;
      }
    }

    throw conflict("RULE_SET_CODE_GENERATION_FAILED", "Unable to generate a unique rule code");
  }

  private generateRuleSetCode(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let index = 0; index < 6; index += 1) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)]!;
    }
    return result;
  }
}
