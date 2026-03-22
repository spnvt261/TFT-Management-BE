// @ts-nocheck
import { AppError } from "../../src/core/errors/app-error.js";
import type { ModuleType } from "../../src/domain/models/enums.js";
import type { AppServices } from "../../src/core/types/container.js";
import { randomUUID } from "node:crypto";

interface Player {
  id: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RuleSet {
  id: string;
  module: ModuleType;
  code: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  versions: Array<any>;
}

interface MatchRecord {
  id: string;
  module: ModuleType;
  playedAt: string;
  participantCount: number;
  ruleSetId: string;
  ruleSetVersionId: string;
  participants: Array<{ playerId: string; tftPlacement: number }>;
  status: "POSTED" | "VOIDED";
}

function uid(prefix: string): string {
  void prefix;
  return randomUUID();
}

export function createMockServices(): AppServices {
  const players = new Map<string, Player>();
  const rules = new Map<string, RuleSet>();
  const presets = new Map<ModuleType, any>();
  const matches = new Map<string, MatchRecord>();

  const now = new Date().toISOString();

  const p1: Player = {
    id: "10000000-0000-4000-8000-000000000001",
    displayName: "An",
    slug: "an",
    avatarUrl: null,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  const p2: Player = {
    id: "10000000-0000-4000-8000-000000000002",
    displayName: "Binh",
    slug: "binh",
    avatarUrl: null,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  const p3: Player = {
    id: "10000000-0000-4000-8000-000000000003",
    displayName: "Chi",
    slug: "chi",
    avatarUrl: null,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  const p4: Player = {
    id: "10000000-0000-4000-8000-000000000004",
    displayName: "Dung",
    slug: "dung",
    avatarUrl: null,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };

  [p1, p2, p3, p4].forEach((player) => players.set(player.id, player));

  const msRuleSet: RuleSet = {
    id: "20000000-0000-4000-8000-000000000001",
    module: "MATCH_STAKES",
    code: "MATCH_STAKES_DEFAULT",
    name: "Match Stakes Default",
    description: null,
    status: "ACTIVE",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    versions: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        ruleSetId: "20000000-0000-4000-8000-000000000001",
        versionNo: 1,
        participantCountMin: 3,
        participantCountMax: 4,
        effectiveFrom: now,
        effectiveTo: null,
        isActive: true,
        summaryJson: null,
        createdAt: now,
        rules: []
      }
    ]
  };

  const gfRuleSet: RuleSet = {
    id: "20000000-0000-4000-8000-000000000002",
    module: "GROUP_FUND",
    code: "GROUP_FUND_DEFAULT",
    name: "Group Fund Default",
    description: null,
    status: "ACTIVE",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    versions: [
      {
        id: "30000000-0000-4000-8000-000000000002",
        ruleSetId: "20000000-0000-4000-8000-000000000002",
        versionNo: 1,
        participantCountMin: 3,
        participantCountMax: 3,
        effectiveFrom: now,
        effectiveTo: null,
        isActive: true,
        summaryJson: null,
        rules: []
      }
    ]
  };

  rules.set(msRuleSet.id, msRuleSet);
  rules.set(gfRuleSet.id, gfRuleSet);

  presets.set("MATCH_STAKES", {
    module: "MATCH_STAKES",
    lastRuleSetId: null,
    lastRuleSetVersionId: null,
    lastSelectedPlayerIds: [],
    lastParticipantCount: null,
    lastUsedAt: null
  });
  presets.set("GROUP_FUND", {
    module: "GROUP_FUND",
    lastRuleSetId: null,
    lastRuleSetVersionId: null,
    lastSelectedPlayerIds: [],
    lastParticipantCount: null,
    lastUsedAt: null
  });

  const services: AppServices = {
    repositories: {} as any,
    groupId: "group-1",
    players: {
      list: async ({ isActive, search, page, pageSize }) => {
        let items = Array.from(players.values());
        if (isActive !== undefined) {
          items = items.filter((item) => item.isActive === isActive);
        }
        if (search) {
          items = items.filter((item) => item.displayName.toLowerCase().includes(search.toLowerCase()));
        }
        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize),
          total: items.length
        };
      },
      create: async (input) => {
        const id = uid("player");
        const item: Player = {
          id,
          displayName: input.displayName,
          slug: input.slug,
          avatarUrl: input.avatarUrl,
          isActive: input.isActive,
          createdAt: now,
          updatedAt: now
        };
        players.set(id, item);
        return item;
      },
      getById: async (playerId) => {
        const player = players.get(playerId);
        if (!player) {
          throw new AppError(404, "PLAYER_NOT_FOUND", "Player not found");
        }
        return player;
      },
      update: async (playerId, input) => {
        const current = players.get(playerId);
        if (!current) {
          throw new AppError(404, "PLAYER_NOT_FOUND", "Player not found");
        }

        const updated: Player = {
          ...current,
          displayName: input.displayName ?? current.displayName,
          slug: input.slug === undefined ? current.slug : input.slug,
          avatarUrl: input.avatarUrl === undefined ? current.avatarUrl : input.avatarUrl,
          isActive: input.isActive ?? current.isActive,
          updatedAt: new Date().toISOString()
        };
        players.set(playerId, updated);
        return updated;
      },
      softDelete: async (playerId) => {
        const current = players.get(playerId);
        if (!current) {
          throw new AppError(404, "PLAYER_NOT_FOUND", "Player not found");
        }
        current.isActive = false;
        current.updatedAt = new Date().toISOString();
        players.set(playerId, current);
        return current;
      }
    } as any,
    rules: {
      listRuleSets: async ({ module, page, pageSize }) => {
        let items = Array.from(rules.values());
        if (module) {
          items = items.filter((item) => item.module === module);
        }
        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize),
          total: items.length
        };
      },
      createRuleSet: async (input) => {
        const id = uid("ruleset");
        const created: RuleSet = {
          id,
          module: input.module,
          code: input.code,
          name: input.name,
          description: input.description,
          status: input.status,
          isDefault: input.isDefault,
          createdAt: now,
          updatedAt: now,
          versions: []
        };
        rules.set(id, created);
        return created;
      },
      getRuleSet: async (ruleSetId) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }
        return item;
      },
      updateRuleSet: async (ruleSetId, input) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }
        const updated = {
          ...item,
          name: input.name ?? item.name,
          description: input.description === undefined ? item.description : input.description,
          isDefault: input.isDefault ?? item.isDefault,
          status: input.status ?? item.status
        };
        rules.set(ruleSetId, updated);
        return updated;
      },
      createVersion: async (ruleSetId, input) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }

        const version = {
          id: uid("version"),
          ruleSetId,
          versionNo: item.versions.length + 1,
          participantCountMin: input.participantCountMin,
          participantCountMax: input.participantCountMax,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          isActive: input.isActive,
          summaryJson: input.summaryJson,
          createdAt: new Date().toISOString(),
          rules: input.rules
        };

        item.versions.unshift(version);
        rules.set(ruleSetId, item);
        return version;
      },
      getVersion: async (ruleSetId, versionId) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }
        const version = item.versions.find((it) => it.id === versionId);
        if (!version) {
          throw new AppError(404, "RULE_SET_VERSION_NOT_FOUND", "Rule set version not found");
        }
        return version;
      },
      updateVersion: async (ruleSetId, versionId, input) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }
        const version = item.versions.find((it) => it.id === versionId);
        if (!version) {
          throw new AppError(404, "RULE_SET_VERSION_NOT_FOUND", "Rule set version not found");
        }
        Object.assign(version, input);
        return version;
      },
      getDefaultByModule: async (module) => {
        const item = Array.from(rules.values()).find((value) => value.module === module && value.isDefault);
        if (!item) {
          throw new AppError(404, "RULE_SET_DEFAULT_NOT_FOUND", "Not found");
        }
        return {
          ruleSet: item,
          activeVersion: item.versions[0] ?? null
        };
      }
    } as any,
    presets: {
      getByModule: async (module) => presets.get(module),
      upsert: async (input) => {
        const value = {
          module: input.module,
          lastRuleSetId: input.lastRuleSetId,
          lastRuleSetVersionId: input.lastRuleSetVersionId,
          lastSelectedPlayerIds: input.lastSelectedPlayerIds,
          lastParticipantCount: input.lastParticipantCount,
          lastUsedAt: input.lastUsedAt ?? new Date().toISOString()
        };
        presets.set(input.module, value);
        return value;
      }
    } as any,
    matches: {
      createMatch: async (input) => {
        if (input.participants.length !== 3 && input.participants.length !== 4) {
          throw new AppError(400, "MATCH_PARTICIPANT_COUNT_INVALID", "Participants must contain 3 or 4 players");
        }

        const playerIds = input.participants.map((item) => item.playerId);
        if (new Set(playerIds).size !== playerIds.length) {
          throw new AppError(400, "MATCH_DUPLICATE_PLAYER", "Player IDs must be unique");
        }

        const placements = input.participants.map((item) => item.tftPlacement);
        if (new Set(placements).size !== placements.length) {
          throw new AppError(400, "MATCH_DUPLICATE_PLACEMENT", "TFT placements must be unique");
        }

        const ruleSet = rules.get(input.ruleSetId);
        if (!ruleSet || ruleSet.module !== input.module) {
          throw new AppError(422, "MATCH_RULE_SET_MODULE_MISMATCH", "Rule set module does not match request module");
        }

        const id = uid("match");
        const version = ruleSet.versions[0];

        const record: MatchRecord = {
          id,
          module: input.module,
          playedAt: input.playedAt,
          participantCount: input.participants.length,
          ruleSetId: input.ruleSetId,
          ruleSetVersionId: version?.id ?? "",
          participants: input.participants,
          status: "POSTED"
        };

        matches.set(id, record);
        presets.set(input.module, {
          module: input.module,
          lastRuleSetId: input.ruleSetId,
          lastRuleSetVersionId: version?.id ?? null,
          lastSelectedPlayerIds: input.participants.map((participant) => participant.playerId),
          lastParticipantCount: input.participants.length,
          lastUsedAt: input.playedAt
        });

        return {
          id,
          module: input.module,
          playedAt: input.playedAt,
          participantCount: input.participants.length,
          status: "POSTED",
          participants: input.participants.map((participant, index) => ({
            playerId: participant.playerId,
            playerName: players.get(participant.playerId)?.displayName ?? participant.playerId,
            tftPlacement: participant.tftPlacement,
            relativeRank: index + 1,
            isWinnerAmongParticipants: index === 0,
            settlementNetVnd: 0
          })),
          settlement: {
            id: uid("settlement"),
            totalTransferVnd: 0,
            totalFundInVnd: 0,
            totalFundOutVnd: 0,
            engineVersion: "v-test",
            ruleSnapshot: {},
            resultSnapshot: {},
            postedToLedgerAt: new Date().toISOString(),
            lines: []
          }
        };
      },
      listMatches: async ({ module, page, pageSize }) => {
        let items = Array.from(matches.values());
        if (module) {
          items = items.filter((item) => item.module === module);
        }
        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize).map((item) => ({
            ...item,
            participants: item.participants.map((participant, index) => ({
              playerId: participant.playerId,
              playerName: players.get(participant.playerId)?.displayName ?? participant.playerId,
              tftPlacement: participant.tftPlacement,
              relativeRank: index + 1,
              settlementNetVnd: 0
            })),
            ruleSetName: rules.get(item.ruleSetId)?.name ?? "unknown",
            notePreview: null,
            totalTransferVnd: 0,
            totalFundInVnd: 0,
            totalFundOutVnd: 0,
            createdAt: now
          })),
          total: items.length
        };
      },
      getMatchDetail: async (matchId) => {
        const item = matches.get(matchId);
        if (!item) {
          throw new AppError(404, "MATCH_NOT_FOUND", "Match not found");
        }

        return {
          id: item.id,
          module: item.module,
          playedAt: item.playedAt,
          participantCount: item.participantCount,
          status: item.status,
          note: null,
          ruleSet: {
            id: item.ruleSetId,
            name: rules.get(item.ruleSetId)?.name ?? "unknown",
            module: item.module
          },
          ruleSetVersion: {
            id: item.ruleSetVersionId,
            versionNo: 1,
            participantCountMin: 3,
            participantCountMax: 4,
            effectiveFrom: now,
            effectiveTo: null
          },
          participants: item.participants.map((participant, index) => ({
            playerId: participant.playerId,
            playerName: players.get(participant.playerId)?.displayName ?? participant.playerId,
            tftPlacement: participant.tftPlacement,
            relativeRank: index + 1,
            isWinnerAmongParticipants: index === 0,
            settlementNetVnd: 0
          })),
          settlement: {
            id: uid("settlement"),
            totalTransferVnd: 0,
            totalFundInVnd: 0,
            totalFundOutVnd: 0,
            engineVersion: "v-test",
            ruleSnapshot: {},
            resultSnapshot: {},
            postedToLedgerAt: now,
            lines: []
          },
          createdAt: now,
          updatedAt: now
        };
      },
      voidMatch: async (matchId, reason) => {
        const item = matches.get(matchId);
        if (!item) {
          throw new AppError(404, "MATCH_NOT_FOUND", "Match not found");
        }
        item.status = "VOIDED";
        matches.set(matchId, item);

        return {
          id: matchId,
          status: "VOIDED",
          reason,
          voidedAt: new Date().toISOString()
        };
      }
    } as any,
    matchStakes: {
      getSummary: async () => ({
        module: "MATCH_STAKES",
        players: Array.from(players.values()).map((item) => ({
          playerId: item.id,
          playerName: item.displayName,
          totalNetVnd: 0,
          totalMatches: 0,
          firstPlaceCountAmongParticipants: 0,
          biggestLossCount: 0
        })),
        debtSuggestions: [],
        totalMatches: Array.from(matches.values()).filter((item) => item.module === "MATCH_STAKES").length,
        range: { from: null, to: null }
      }),
      getLedger: async ({ page, pageSize }) => ({
        items: [],
        total: 0,
        page,
        pageSize
      }),
      getMatches: async ({ page, pageSize }) => {
        const items = Array.from(matches.values()).filter((item) => item.module === "MATCH_STAKES");
        return { items, total: items.length, page, pageSize };
      }
    } as any,
    groupFund: {
      getSummary: async () => ({
        module: "GROUP_FUND",
        fundBalanceVnd: 0,
        totalMatches: Array.from(matches.values()).filter((item) => item.module === "GROUP_FUND").length,
        players: Array.from(players.values()).map((item) => ({
          playerId: item.id,
          playerName: item.displayName,
          totalContributedVnd: 0,
          currentObligationVnd: 0
        })),
        range: { from: null, to: null }
      }),
      getLedger: async ({ page, pageSize }) => ({
        items: [],
        total: 0,
        page,
        pageSize
      }),
      getMatches: async ({ page, pageSize }) => {
        const items = Array.from(matches.values()).filter((item) => item.module === "GROUP_FUND");
        return { items, total: items.length, page, pageSize };
      }
    } as any
  };

  return services;
}
