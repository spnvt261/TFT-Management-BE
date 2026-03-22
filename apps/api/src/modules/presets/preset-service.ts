import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";
import type { ModuleType } from "../../domain/models/enums.js";

export class PresetService {
  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

  public getByModule(module: ModuleType) {
    return this.repositories.presets.getByModule(this.groupId, module);
  }

  public async upsert(input: {
    module: ModuleType;
    lastRuleSetId: string | null;
    lastRuleSetVersionId: string | null;
    lastSelectedPlayerIds: string[];
    lastParticipantCount: number;
    lastUsedAt?: string;
  }) {
    await this.repositories.presets.upsert({
      groupId: this.groupId,
      module: input.module,
      lastRuleSetId: input.lastRuleSetId,
      lastRuleSetVersionId: input.lastRuleSetVersionId,
      lastSelectedPlayerIds: input.lastSelectedPlayerIds,
      lastParticipantCount: input.lastParticipantCount,
      lastUsedAt: input.lastUsedAt
    });

    return this.getByModule(input.module);
  }
}
