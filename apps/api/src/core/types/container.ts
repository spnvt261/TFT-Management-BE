import type { Pool } from "pg";
import { env } from "../config/env.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { resolveDefaultGroupId } from "../../modules/system/group-context.js";
import { PlayerService } from "../../modules/players/player-service.js";
import { RuleService } from "../../modules/rules/rule-service.js";
import { PresetService } from "../../modules/presets/preset-service.js";
import { MatchService } from "../../modules/matches/match-service.js";
import { MatchStakesService } from "../../modules/match-stakes/match-stakes-service.js";
import { GroupFundService } from "../../modules/group-fund/group-fund-service.js";

export interface AppServices {
  repositories: RepositoryBundle;
  groupId: string;
  players: PlayerService;
  rules: RuleService;
  presets: PresetService;
  matches: MatchService;
  matchStakes: MatchStakesService;
  groupFund: GroupFundService;
}

export async function buildServices(pool: Pool): Promise<AppServices> {
  const repositories = createRepositories(pool);
  const groupId = await resolveDefaultGroupId(repositories, env.defaultGroupCode);

  return {
    repositories,
    groupId,
    players: new PlayerService(repositories, groupId),
    rules: new RuleService(pool, repositories, groupId),
    presets: new PresetService(repositories, groupId),
    matches: new MatchService(pool, repositories, groupId),
    matchStakes: new MatchStakesService(pool, repositories, groupId),
    groupFund: new GroupFundService(pool, repositories, groupId)
  };
}
