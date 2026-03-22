import { notFound } from "../../core/errors/app-error.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";

export async function resolveDefaultGroupId(repositories: RepositoryBundle, defaultGroupCode: string): Promise<string> {
  const group = await repositories.groups.findByCode(defaultGroupCode);
  if (!group) {
    throw notFound("GROUP_NOT_FOUND", `Default group with code ${defaultGroupCode} not found`);
  }

  return group.id;
}
