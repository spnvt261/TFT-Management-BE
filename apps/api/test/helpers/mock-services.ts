// @ts-nocheck
import { AppError } from "../../src/core/errors/app-error.js";
import type { ModuleType } from "../../src/domain/models/enums.js";
import type { AppServices } from "../../src/core/types/container.js";
import { randomUUID } from "node:crypto";
import { MatchStakesBuilderValidationService } from "../../src/modules/rules/match-stakes-builder-validation.service.js";
import { MatchStakesBuilderCompileService } from "../../src/modules/rules/match-stakes-builder-compile.service.js";

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
  confirmationMode: "ENGINE" | "MANUAL_ADJUSTED";
  overrideReason: string | null;
  manualAdjusted: boolean;
  status: "POSTED" | "VOIDED";
  debtPeriodId: string | null;
  debtPeriodNo: number | null;
  periodMatchNo: number | null;
}

interface ManualGroupFundTransaction {
  batchId: string;
  entryId: string;
  postedAt: string;
  sourceType: "MANUAL_ADJUSTMENT" | "SYSTEM_CORRECTION";
  transactionType: "CONTRIBUTION" | "WITHDRAWAL" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  playerId: string | null;
  playerName: string | null;
  amountVnd: number;
  reason: string;
}

interface MatchStakesDebtPeriodRecord {
  id: string;
  periodNo: number;
  title: string | null;
  note: string | null;
  closeNote: string | null;
  nextPeriodId: string | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
}

interface MatchStakesDebtSettlementRecord {
  id: string;
  periodId: string;
  postedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lines: Array<{
    id: string;
    payerPlayerId: string;
    receiverPlayerId: string;
    amountVnd: number;
    note: string | null;
    createdAt: string;
  }>;
}

function uid(prefix: string): string {
  void prefix;
  return randomUUID();
}

function createRuleCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let index = 0; index < 6; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return result;
}

export function createMockServices(): AppServices {
  const players = new Map<string, Player>();
  const rules = new Map<string, RuleSet>();
  const presets = new Map<ModuleType, any>();
  const matches = new Map<string, MatchRecord>();
  const manualGroupFundTransactions: ManualGroupFundTransaction[] = [];
  const debtPeriods: MatchStakesDebtPeriodRecord[] = [];
  const debtSettlementsByPeriod = new Map<string, MatchStakesDebtSettlementRecord[]>();
  const debtPeriodInitBalances = new Map<string, Map<string, number>>();
  const builderValidationService = new MatchStakesBuilderValidationService();
  const builderCompileService = new MatchStakesBuilderCompileService();

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
        description: "Default Match Stakes rule",
        participantCountMin: 3,
        participantCountMax: 4,
        effectiveFrom: now,
        effectiveTo: null,
        isActive: true,
        summaryJson: null,
        builderType: null,
        builderConfig: null,
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
        description: "Default Group Fund rule",
        participantCountMin: 3,
        participantCountMax: 3,
        effectiveFrom: now,
        effectiveTo: null,
        isActive: true,
        summaryJson: null,
        builderType: null,
        builderConfig: null,
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

  const toRuleSetResponse = (item: RuleSet) => ({
    ...item,
    description: item.versions[0]?.description ?? null
  });

  const getCurrentOpenDebtPeriod = (): MatchStakesDebtPeriodRecord | null =>
    debtPeriods.find((period) => period.status === "OPEN") ?? null;

  const createDebtPeriod = (input: { title?: string | null; note?: string | null }): MatchStakesDebtPeriodRecord => {
    const existing = getCurrentOpenDebtPeriod();
    if (existing) {
      throw new AppError(409, "DEBT_PERIOD_OPEN_ALREADY_EXISTS", "An open debt period already exists for this group");
    }

    const maxPeriodNo = debtPeriods.reduce((max, period) => Math.max(max, period.periodNo), 0);
    const created: MatchStakesDebtPeriodRecord = {
      id: uid("debt-period"),
      periodNo: maxPeriodNo + 1,
      title: input.title ?? null,
      note: input.note ?? null,
      closeNote: null,
      nextPeriodId: null,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      closedAt: null
    };
    debtPeriods.unshift(created);
    debtPeriodInitBalances.set(created.id, new Map());
    return created;
  };

  const getOrCreateOpenDebtPeriod = (): MatchStakesDebtPeriodRecord => {
    return getCurrentOpenDebtPeriod() ?? createDebtPeriod({});
  };

  const computeMatchStakesNets = (match: MatchRecord): Map<string, number> => {
    const ranked = [...match.participants].sort((left, right) => left.tftPlacement - right.tftPlacement);
    const winner = ranked[0];
    const losers = ranked.slice(1);
    const winnerGain = losers.length > 0 ? 100000 : 0;
    const loserShare = losers.length > 0 ? Math.floor(winnerGain / losers.length) : 0;
    let remaining = winnerGain;
    const netByPlayer = new Map<string, number>();

    if (winner) {
      netByPlayer.set(winner.playerId, winnerGain);
    }

    for (const [index, loser] of losers.entries()) {
      const amount = index === losers.length - 1 ? remaining : loserShare;
      remaining -= amount;
      netByPlayer.set(loser.playerId, -amount);
    }

    return netByPlayer;
  };

  const buildDebtPeriodSummary = (periodId: string) => {
    const scopedMatches = Array.from(matches.values()).filter(
      (match) => match.module === "MATCH_STAKES" && match.debtPeriodId === periodId && match.status !== "VOIDED"
    );
    const settlements = debtSettlementsByPeriod.get(periodId) ?? [];
    const initBalances = debtPeriodInitBalances.get(periodId) ?? new Map<string, number>();

    const playerSummaryMap = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        totalMatches: number;
        initNetVnd: number;
        accruedNetVnd: number;
        settledPaidVnd: number;
        settledReceivedVnd: number;
      }
    >();

    const ensurePlayer = (playerId: string) => {
      const existing = playerSummaryMap.get(playerId);
      if (existing) {
        return existing;
      }
      const created = {
        playerId,
        playerName: players.get(playerId)?.displayName ?? playerId,
        totalMatches: 0,
        initNetVnd: initBalances.get(playerId) ?? 0,
        accruedNetVnd: 0,
        settledPaidVnd: 0,
        settledReceivedVnd: 0
      };
      playerSummaryMap.set(playerId, created);
      return created;
    };

    for (const activePlayer of players.values()) {
      if (activePlayer.isActive) {
        ensurePlayer(activePlayer.id);
      }
    }

    for (const [playerId, initNetVnd] of initBalances.entries()) {
      const player = ensurePlayer(playerId);
      player.initNetVnd = initNetVnd;
    }

    for (const match of scopedMatches) {
      const netByPlayer = computeMatchStakesNets(match);
      for (const [playerId, netVnd] of netByPlayer.entries()) {
        const item = ensurePlayer(playerId);
        item.accruedNetVnd += netVnd;
      }

      for (const participant of match.participants) {
        const player = ensurePlayer(participant.playerId);
        player.totalMatches += 1;
      }
    }

    for (const settlement of settlements) {
      for (const line of settlement.lines) {
        const payer = ensurePlayer(line.payerPlayerId);
        const receiver = ensurePlayer(line.receiverPlayerId);
        payer.settledPaidVnd += line.amountVnd;
        receiver.settledReceivedVnd += line.amountVnd;
      }
    }

    const playersSummary = Array.from(playerSummaryMap.values()).map((player) => ({
      ...player,
      outstandingNetVnd: player.initNetVnd + player.accruedNetVnd - player.settledReceivedVnd + player.settledPaidVnd
    }));

    const summary = {
      totalMatches: scopedMatches.length,
      totalPlayers: playersSummary.length,
      totalOutstandingReceiveVnd: playersSummary
        .filter((player) => player.outstandingNetVnd > 0)
        .reduce((sum, player) => sum + player.outstandingNetVnd, 0),
      totalOutstandingPayVnd: playersSummary
        .filter((player) => player.outstandingNetVnd < 0)
        .reduce((sum, player) => sum + Math.abs(player.outstandingNetVnd), 0)
    };

    return {
      players: playersSummary,
      summary
    };
  };

  const buildDebtPeriodTimeline = (periodId: string, includeInitialSnapshot = true) => {
    const period = debtPeriods.find((item) => item.id === periodId);
    if (!period) {
      throw new AppError(404, "DEBT_PERIOD_NOT_FOUND", "Debt period not found");
    }

    const computed = buildDebtPeriodSummary(period.id);
    const scopedMatches = Array.from(matches.values())
      .filter((match) => match.module === "MATCH_STAKES" && match.debtPeriodId === period.id && match.status !== "VOIDED")
      .sort((left, right) => new Date(left.playedAt).getTime() - new Date(right.playedAt).getTime());

    const playerScope = computed.players.map((item) => ({
      playerId: item.playerId,
      playerName: item.playerName
    }));
    const initByPlayer = new Map(computed.players.map((item) => [item.playerId, item.initNetVnd]));
    const cumulativeByPlayer = new Map(playerScope.map((item) => [item.playerId, initByPlayer.get(item.playerId) ?? 0]));

    const timelineAscending = scopedMatches.map((match, index) => {
      const sortedParticipants = [...match.participants].sort((left, right) => left.tftPlacement - right.tftPlacement);
      const netByPlayer = computeMatchStakesNets(match);
      const participantByPlayerId = new Map(
        sortedParticipants.map((participant, participantIndex) => [
          participant.playerId,
          {
            tftPlacement: participant.tftPlacement,
            relativeRank: participantIndex + 1
          }
        ])
      );

      const rows = playerScope
        .map((player) => {
          const participant = participantByPlayerId.get(player.playerId);
          const matchNetVnd = netByPlayer.get(player.playerId) ?? 0;
          const cumulativeNetVnd = (cumulativeByPlayer.get(player.playerId) ?? 0) + matchNetVnd;
          cumulativeByPlayer.set(player.playerId, cumulativeNetVnd);

          return {
            playerId: player.playerId,
            playerName: player.playerName,
            tftPlacement: participant?.tftPlacement ?? null,
            relativeRank: participant?.relativeRank ?? null,
            matchNetVnd,
            cumulativeNetVnd
          };
        })
        .sort((left, right) => {
          const leftRank = left.relativeRank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.relativeRank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
          const byName = left.playerName.localeCompare(right.playerName);
          if (byName !== 0) {
            return byName;
          }
          return left.playerId.localeCompare(right.playerId);
        });

      return {
        type: "MATCH" as const,
        matchId: match.id,
        playedAt: match.playedAt,
        matchNo: match.periodMatchNo ?? index + 1,
        participantCount: match.participantCount,
        status: match.status,
        rows
      };
    });

    const timeline = [...timelineAscending].reverse();
    if (includeInitialSnapshot) {
      timeline.push({
        type: "INITIAL" as const,
        matchId: null,
        playedAt: null,
        matchNo: null,
        participantCount: null,
        status: null,
        rows: playerScope
          .map((player) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            tftPlacement: null,
            relativeRank: null,
            matchNetVnd: initByPlayer.get(player.playerId) ?? 0,
            cumulativeNetVnd: initByPlayer.get(player.playerId) ?? 0
          }))
          .sort((left, right) => {
            const byName = left.playerName.localeCompare(right.playerName);
            if (byName !== 0) {
              return byName;
            }
            return left.playerId.localeCompare(right.playerId);
          })
      });
    }

    return {
      period,
      summary: computed.summary,
      currentPlayers: computed.players,
      timeline
    };
  };

  const toRuleSetDetailResponse = (item: RuleSet) => {
    const normalized = toRuleSetResponse(item);
    return {
      ...normalized,
      latestVersion: normalized.versions[0] ?? null,
      versions: [...normalized.versions]
    };
  };

  const createVersionForRuleSet = (
    item: RuleSet,
    input: {
      description: string | null;
      participantCountMin: number;
      participantCountMax: number;
      effectiveTo: string | null;
      isActive: boolean;
      summaryJson: unknown;
      builderType?: string | null;
      builderConfig?: unknown | null;
      rules?: Array<any>;
    }
  ) => {
    if (input.participantCountMin > input.participantCountMax) {
      throw new AppError(400, "RULE_SET_VERSION_INVALID", "participantCountMin must be <= participantCountMax");
    }

    const requestedBuilderMode =
      (input.builderType !== undefined && input.builderType !== null) ||
      (input.builderConfig !== undefined && input.builderConfig !== null);

    if (requestedBuilderMode && input.rules) {
      throw new AppError(400, "RULE_BUILDER_INVALID_CONFIG", "Cannot combine builder mode with raw rules");
    }

    let persistedRules = input.rules ?? [];
    let persistedBuilderConfig = input.builderConfig ?? null;
    let persistedBuilderType = input.builderType ?? null;

    if (requestedBuilderMode) {
      if (!input.builderType || input.builderConfig === undefined || input.builderConfig === null) {
        throw new AppError(400, "RULE_BUILDER_INVALID_CONFIG", "builderType and builderConfig are both required");
      }

      if (input.builderType === "MATCH_STAKES_PAYOUT") {
        const normalized = builderValidationService.validate({
          module: item.module,
          participantCountMin: input.participantCountMin,
          participantCountMax: input.participantCountMax,
          builderConfig: input.builderConfig
        });
        persistedBuilderConfig = normalized;
        persistedRules = builderCompileService.compile(normalized);
        persistedBuilderType = input.builderType;
      }
    } else if (!persistedRules || persistedRules.length === 0) {
      throw new AppError(400, "RULE_SET_VERSION_INVALID", "rules is required when builder mode is not used");
    }

    return {
      id: uid("version"),
      ruleSetId: item.id,
      versionNo: item.versions.length + 1,
      description: input.description ?? null,
      participantCountMin: input.participantCountMin,
      participantCountMax: input.participantCountMax,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: input.effectiveTo,
      isActive: input.isActive,
      summaryJson: input.summaryJson,
      builderType: persistedBuilderType,
      builderConfig: persistedBuilderConfig,
      createdAt: new Date().toISOString(),
      rules: persistedRules
    };
  };

  const services: AppServices = {
    repositories: {
      roles: {
        findByCode: async (code: string) => {
          if (code === "ADMIN") {
            return {
              id: "90000000-0000-4000-8000-000000000001",
              code: "ADMIN",
              name: "Administrator",
              createdAt: now,
              updatedAt: now
            };
          }

          if (code === "USER") {
            return {
              id: "90000000-0000-4000-8000-000000000002",
              code: "USER",
              name: "User",
              createdAt: now,
              updatedAt: now
            };
          }

          return null;
        }
      }
    } as any,
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
      listRuleSets: async ({ module, modules, status, isDefault, search, from, to, page, pageSize }) => {
        let items = Array.from(rules.values());

        const moduleFilters = Array.isArray(modules) && modules.length > 0 ? modules : module ? [module] : undefined;
        if (moduleFilters && moduleFilters.length > 0) {
          items = items.filter((item) => moduleFilters.includes(item.module));
        }

        if (status) {
          items = items.filter((item) => item.status === status);
        }

        if (isDefault !== undefined) {
          items = items.filter((item) => item.isDefault === isDefault);
        }

        if (search) {
          const normalizedSearch = String(search).toLowerCase();
          items = items.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
        }

        if (from) {
          const fromTime = new Date(from).getTime();
          items = items.filter((item) => new Date(item.createdAt).getTime() >= fromTime);
        }

        if (to) {
          const toTime = new Date(to).getTime();
          items = items.filter((item) => new Date(item.createdAt).getTime() <= toTime);
        }

        items = items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize).map((item) => toRuleSetResponse(item)),
          total: items.length
        };
      },
      createRule: async (input) => {
        const id = uid("ruleset");
        if (input.isDefault) {
          for (const existing of rules.values()) {
            if (existing.module === input.module) {
              existing.isDefault = false;
            }
          }
        }

        const created: RuleSet = {
          id,
          module: input.module,
          code: createRuleCode(),
          name: input.name,
          description: null,
          status: input.status,
          isDefault: input.isDefault,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          versions: []
        };

        const version = createVersionForRuleSet(created, {
          description: input.version.description,
          participantCountMin: input.version.participantCountMin,
          participantCountMax: input.version.participantCountMax,
          effectiveTo: input.version.effectiveTo,
          isActive: input.version.isActive,
          summaryJson: input.version.summaryJson,
          builderType: input.version.builderType,
          builderConfig: input.version.builderConfig,
          rules: input.version.rules
        });

        created.versions.unshift(version);
        rules.set(id, created);
        return toRuleSetDetailResponse(created);
      },
      getRuleSet: async (ruleSetId) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }
        return toRuleSetDetailResponse(item);
      },
      editRule: async (ruleSetId, input) => {
        const item = rules.get(ruleSetId);
        if (!item) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }

        if (input.module !== undefined && input.module !== item.module) {
          throw new AppError(400, "RULE_SET_MODULE_IMMUTABLE", "module cannot be changed when editing a rule");
        }

        if (input.code !== undefined && input.code !== item.code) {
          throw new AppError(400, "RULE_SET_CODE_IMMUTABLE", "code cannot be changed when editing a rule");
        }

        if (input.isDefault === true) {
          for (const existing of rules.values()) {
            if (existing.module === item.module) {
              existing.isDefault = false;
            }
          }
        }

        item.name = input.name ?? item.name;
        item.status = input.status ?? item.status;
        item.isDefault = input.isDefault ?? item.isDefault;
        item.updatedAt = new Date().toISOString();

        const baseVersion = item.versions[0];
        if (!baseVersion) {
          throw new AppError(404, "RULE_SET_VERSION_NOT_FOUND", "Rule set version not found");
        }

        const builderFieldsProvided = input.version.builderType !== undefined || input.version.builderConfig !== undefined;
        const rulesProvided = input.version.rules !== undefined;

        const nextVersionInput = {
          description: input.version.description === undefined ? baseVersion.description : input.version.description,
          participantCountMin: input.version.participantCountMin ?? baseVersion.participantCountMin,
          participantCountMax: input.version.participantCountMax ?? baseVersion.participantCountMax,
          effectiveTo: input.version.effectiveTo === undefined ? baseVersion.effectiveTo : input.version.effectiveTo,
          isActive: input.version.isActive ?? baseVersion.isActive,
          summaryJson: input.version.summaryJson === undefined ? baseVersion.summaryJson : input.version.summaryJson,
          builderType: input.version.builderType,
          builderConfig: input.version.builderConfig,
          rules: input.version.rules
        };

        if (rulesProvided && !builderFieldsProvided) {
          nextVersionInput.builderType = null;
          nextVersionInput.builderConfig = null;
        } else if (builderFieldsProvided) {
          nextVersionInput.builderType = input.version.builderType === undefined ? baseVersion.builderType : input.version.builderType;
          nextVersionInput.builderConfig =
            input.version.builderConfig === undefined ? baseVersion.builderConfig : input.version.builderConfig;
        } else if (baseVersion.builderType !== null || baseVersion.builderConfig !== null) {
          nextVersionInput.builderType = baseVersion.builderType;
          nextVersionInput.builderConfig = baseVersion.builderConfig;
          nextVersionInput.rules = undefined;
        } else {
          nextVersionInput.builderType = null;
          nextVersionInput.builderConfig = null;
          nextVersionInput.rules = baseVersion.rules;
        }

        const newVersion = createVersionForRuleSet(item, {
          description: nextVersionInput.description,
          participantCountMin: nextVersionInput.participantCountMin,
          participantCountMax: nextVersionInput.participantCountMax,
          effectiveTo: nextVersionInput.effectiveTo,
          isActive: nextVersionInput.isActive,
          summaryJson: nextVersionInput.summaryJson,
          builderType: nextVersionInput.builderType,
          builderConfig: nextVersionInput.builderConfig,
          rules: nextVersionInput.rules
        });

        for (const version of item.versions) {
          if (version.isActive) {
            version.isActive = false;
            if (!version.effectiveTo || version.effectiveTo > newVersion.effectiveFrom) {
              version.effectiveTo = newVersion.effectiveFrom;
            }
          }
        }

        item.versions.unshift(newVersion);
        rules.set(ruleSetId, item);
        return toRuleSetDetailResponse(item);
      },
      getDefaultByModule: async (module, participantCount) => {
        const item = Array.from(rules.values()).find((value) => value.module === module && value.isDefault);
        if (!item) {
          throw new AppError(404, "RULE_SET_DEFAULT_NOT_FOUND", "Not found");
        }
        return {
          ruleSet: toRuleSetResponse(item),
          activeVersion:
            participantCount === undefined
              ? null
              : (item.versions.find(
                  (version) => version.participantCountMin <= participantCount && version.participantCountMax >= participantCount
                ) ?? null)
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
      previewMatch: async (input) => {
        if (input.participants.length !== 3 && input.participants.length !== 4) {
          throw new AppError(400, "MATCH_PREVIEW_INVALID", "Participants must contain 3 or 4 players");
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
        if (!ruleSet) {
          throw new AppError(404, "RULE_SET_NOT_FOUND", "Rule set not found");
        }
        if (ruleSet.module !== input.module) {
          throw new AppError(422, "MATCH_RULE_SET_MODULE_MISMATCH", "Rule set module does not match request module");
        }

        const version = ruleSet.versions[0];
        if (!version) {
          throw new AppError(422, "RULE_SET_VERSION_NOT_APPLICABLE", "No applicable rule set version");
        }

        const sorted = [...input.participants].sort((left, right) => left.tftPlacement - right.tftPlacement);

        return {
          module: input.module,
          note: input.note ?? null,
          ruleSet: {
            id: ruleSet.id,
            name: ruleSet.name,
            module: ruleSet.module
          },
          ruleSetVersion: {
            id: version.id,
            versionNo: version.versionNo,
            participantCountMin: version.participantCountMin,
            participantCountMax: version.participantCountMax,
            effectiveFrom: version.effectiveFrom,
            effectiveTo: version.effectiveTo
          },
          participants: sorted.map((participant, index) => ({
            playerId: participant.playerId,
            playerName: players.get(participant.playerId)?.displayName ?? participant.playerId,
            tftPlacement: participant.tftPlacement,
            relativeRank: index + 1,
            suggestedNetVnd: 0
          })),
          settlementPreview: {
            totalTransferVnd: 0,
            totalFundInVnd: 0,
            totalFundOutVnd: 0,
            engineVersion: "v-test",
            ruleSnapshot: {},
            resultSnapshot: {},
            lines: []
          }
        };
      },
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

        const playedAt = input.playedAt ?? new Date().toISOString();
        const id = uid("match");
        const version = ruleSet.versions.find((item) => item.id === input.ruleSetVersionId) ?? ruleSet.versions[0];
        if (!version) {
          throw new AppError(422, "RULE_SET_VERSION_NOT_APPLICABLE", "No applicable rule set version");
        }

        const confirmationMode = input.confirmation?.mode ?? "ENGINE";
        const overrideReason = input.confirmation?.overrideReason ?? null;
        const manualAdjusted = confirmationMode === "MANUAL_ADJUSTED";
        const debtPeriod = input.module === "MATCH_STAKES" ? getOrCreateOpenDebtPeriod() : null;
        const periodMatchNo =
          debtPeriod && input.module === "MATCH_STAKES"
            ? Array.from(matches.values())
                .filter((item) => item.module === "MATCH_STAKES" && item.debtPeriodId === debtPeriod.id)
                .reduce((max, item) => Math.max(max, item.periodMatchNo ?? 0), 0) + 1
            : null;

        const record: MatchRecord = {
          id,
          module: input.module,
          playedAt,
          participantCount: input.participants.length,
          ruleSetId: input.ruleSetId,
          ruleSetVersionId: version.id,
          participants: input.participants,
          confirmationMode,
          overrideReason,
          manualAdjusted,
          status: "POSTED",
          debtPeriodId: debtPeriod?.id ?? null,
          debtPeriodNo: debtPeriod?.periodNo ?? null,
          periodMatchNo
        };

        matches.set(id, record);
        presets.set(input.module, {
          module: input.module,
          lastRuleSetId: input.ruleSetId,
          lastRuleSetVersionId: version.id,
          lastSelectedPlayerIds: input.participants.map((participant) => participant.playerId),
          lastParticipantCount: input.participants.length,
          lastUsedAt: playedAt
        });

        return {
          id,
          module: input.module,
          playedAt,
          participantCount: input.participants.length,
          status: "POSTED",
          debtPeriodId: record.debtPeriodId,
          debtPeriodNo: record.debtPeriodNo,
          periodMatchNo: record.periodMatchNo,
          confirmationMode,
          overrideReason,
          manualAdjusted,
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
      listMatches: async ({ module, status, periodId, page, pageSize }) => {
        let items = Array.from(matches.values());
        if (module) {
          items = items.filter((item) => item.module === module);
        }
        if (status) {
          items = items.filter((item) => item.status === status);
        }
        if (periodId) {
          items = items.filter((item) => item.debtPeriodId === periodId);
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
            ruleSetVersionNo: 1,
            confirmationMode: item.confirmationMode,
            overrideReason: item.overrideReason,
            manualAdjusted: item.manualAdjusted,
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
          debtPeriodId: item.debtPeriodId,
          debtPeriodNo: item.debtPeriodNo,
          periodMatchNo: item.periodMatchNo,
          confirmationMode: item.confirmationMode,
          overrideReason: item.overrideReason,
          manualAdjusted: item.manualAdjusted,
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
          engineCalculationSnapshot: {},
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
      getCurrentDebtPeriod: async () => {
        const period = getCurrentOpenDebtPeriod();
        if (!period) {
          throw new AppError(404, "DEBT_PERIOD_NOT_FOUND", "No open debt period found");
        }
        const computed = buildDebtPeriodSummary(period.id);
        return {
          period,
          summary: computed.summary,
          players: computed.players
        };
      },
      listDebtPeriods: async ({ page, pageSize }) => {
        const sorted = [...debtPeriods].sort((left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime());
        const start = (page - 1) * pageSize;
        const scoped = sorted.slice(start, start + pageSize);
        return {
          items: scoped.map((period) => {
            const computed = buildDebtPeriodSummary(period.id);
            return {
              ...period,
              ...computed.summary
            };
          }),
          total: sorted.length
        };
      },
      getDebtPeriodDetail: async (periodId) => {
        const period = debtPeriods.find((item) => item.id === periodId);
        if (!period) {
          throw new AppError(404, "DEBT_PERIOD_NOT_FOUND", "Debt period not found");
        }
        const computed = buildDebtPeriodSummary(period.id);
        const settlements = (debtSettlementsByPeriod.get(period.id) ?? []).map((settlement) => ({
          ...settlement,
          lines: settlement.lines.map((line) => ({
            ...line,
            payerPlayerName: players.get(line.payerPlayerId)?.displayName ?? line.payerPlayerId,
            receiverPlayerName: players.get(line.receiverPlayerId)?.displayName ?? line.receiverPlayerId
          }))
        }));
        const recentMatches = Array.from(matches.values())
          .filter((match) => match.module === "MATCH_STAKES" && match.debtPeriodId === period.id)
          .slice(0, 20)
          .map((match) => ({
            id: match.id,
            playedAt: match.playedAt,
            participantCount: match.participantCount,
            status: match.status,
            debtPeriodId: match.debtPeriodId,
            debtPeriodNo: match.debtPeriodNo,
            periodMatchNo: match.periodMatchNo
          }));

        return {
          period,
          summary: computed.summary,
          players: computed.players,
          settlements,
          recentMatches
        };
      },
      getDebtPeriodTimeline: async (periodId, input) => {
        return buildDebtPeriodTimeline(periodId, input?.includeInitialSnapshot ?? true);
      },
      createDebtPeriod: async (input) => {
        return createDebtPeriod(input ?? {});
      },
      createDebtSettlement: async (periodId, input) => {
        const period = debtPeriods.find((item) => item.id === periodId);
        if (!period) {
          throw new AppError(404, "DEBT_PERIOD_NOT_FOUND", "Debt period not found");
        }
        if (period.status !== "OPEN") {
          throw new AppError(422, "DEBT_PERIOD_NOT_OPEN", "Debt period is not open");
        }

        if (!input.lines || input.lines.length === 0) {
          throw new AppError(400, "DEBT_SETTLEMENT_INVALID", "Settlement lines must not be empty");
        }

        const currentSummary = buildDebtPeriodSummary(period.id);
        const outstandingByPlayer = new Map(currentSummary.players.map((item) => [item.playerId, item.outstandingNetVnd]));
        const deltaByPlayer = new Map<string, number>();
        for (const line of input.lines) {
          if (line.payerPlayerId === line.receiverPlayerId) {
            throw new AppError(400, "DEBT_SETTLEMENT_INVALID", "payerPlayerId and receiverPlayerId must be different");
          }
          if (!players.get(line.payerPlayerId) || !players.get(line.receiverPlayerId)) {
            throw new AppError(422, "DEBT_SETTLEMENT_INVALID", "Settlement players must exist in current group");
          }
          deltaByPlayer.set(line.payerPlayerId, (deltaByPlayer.get(line.payerPlayerId) ?? 0) + line.amountVnd);
          deltaByPlayer.set(line.receiverPlayerId, (deltaByPlayer.get(line.receiverPlayerId) ?? 0) - line.amountVnd);
        }

        for (const [playerId, delta] of deltaByPlayer.entries()) {
          const before = outstandingByPlayer.get(playerId) ?? 0;
          const after = before + delta;
          if (before === 0 && after !== 0) {
            throw new AppError(422, "DEBT_SETTLEMENT_OVERPAY", "Settlement would overshoot outstanding");
          }
          if (before !== 0) {
            if (after !== 0 && Math.sign(before) !== Math.sign(after)) {
              throw new AppError(422, "DEBT_SETTLEMENT_OVERPAY", "Settlement would overshoot outstanding");
            }
            if (Math.abs(after) > Math.abs(before)) {
              throw new AppError(422, "DEBT_SETTLEMENT_OVERPAY", "Settlement would overshoot outstanding");
            }
          }
        }

        const createdAt = new Date().toISOString();
        const settlement: MatchStakesDebtSettlementRecord = {
          id: uid("debt-settlement"),
          periodId: period.id,
          postedAt: input.postedAt ?? createdAt,
          note: input.note ?? null,
          createdAt,
          updatedAt: createdAt,
          lines: input.lines.map((line) => ({
            id: uid("debt-settlement-line"),
            payerPlayerId: line.payerPlayerId,
            receiverPlayerId: line.receiverPlayerId,
            amountVnd: line.amountVnd,
            note: line.note ?? null,
            createdAt
          }))
        };
        const existing = debtSettlementsByPeriod.get(period.id) ?? [];
        debtSettlementsByPeriod.set(period.id, [settlement, ...existing]);

        const updated = buildDebtPeriodSummary(period.id);
        return {
          settlement: {
            ...settlement,
            lines: settlement.lines.map((line) => ({
              ...line,
              payerPlayerName: players.get(line.payerPlayerId)?.displayName ?? line.payerPlayerId,
              receiverPlayerName: players.get(line.receiverPlayerId)?.displayName ?? line.receiverPlayerId
            }))
          },
          summary: updated.summary,
          players: updated.players
        };
      },
      closeDebtPeriod: async (periodId, input) => {
        const period = debtPeriods.find((item) => item.id === periodId);
        if (!period) {
          throw new AppError(404, "DEBT_PERIOD_NOT_FOUND", "Debt period not found");
        }
        if (period.status !== "OPEN") {
          throw new AppError(422, "DEBT_PERIOD_NOT_OPEN", "Debt period is not open");
        }

        const computed = buildDebtPeriodSummary(period.id);
        const submittedBalances = Array.isArray(input?.closingBalances) ? input.closingBalances : [];
        const seen = new Set<string>();
        for (const item of submittedBalances) {
          if (seen.has(item.playerId)) {
            throw new AppError(400, "DEBT_PERIOD_CLOSING_BALANCE_INVALID", "closingBalances contains duplicate playerId");
          }
          seen.add(item.playerId);
        }

        const playerById = new Map(computed.players.map((item) => [item.playerId, item]));
        for (const item of submittedBalances) {
          if (!playerById.has(item.playerId)) {
            throw new AppError(400, "DEBT_PERIOD_CLOSING_BALANCE_INVALID", "closingBalances contains invalid playerId");
          }
        }

        const normalizedByPlayer = new Map(computed.players.map((item) => [item.playerId, 0]));
        for (const item of submittedBalances) {
          normalizedByPlayer.set(item.playerId, item.netVnd);
        }

        const carryForwardBalances = computed.players.map((item) => ({
          playerId: item.playerId,
          playerName: item.playerName,
          netVnd: normalizedByPlayer.get(item.playerId) ?? 0
        }));
        const totalClosingNetVnd = carryForwardBalances.reduce((sum, item) => sum + item.netVnd, 0);
        if (totalClosingNetVnd !== 0) {
          throw new AppError(422, "DEBT_PERIOD_CLOSING_BALANCE_INVALID", "closingBalances must net to zero");
        }

        period.status = "CLOSED";
        period.closedAt = new Date().toISOString();
        if (input?.note) {
          period.closeNote = input.note;
        }

        const nextPeriod = createDebtPeriod({});
        period.nextPeriodId = nextPeriod.id;
        const nextInit = new Map<string, number>();
        for (const balance of carryForwardBalances) {
          if (balance.netVnd !== 0) {
            nextInit.set(balance.playerId, balance.netVnd);
          }
        }
        debtPeriodInitBalances.set(nextPeriod.id, nextInit);

        return {
          id: period.id,
          status: "CLOSED",
          closedAt: period.closedAt,
          nextPeriod,
          carryForwardBalances
        };
      },
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
          currentObligationVnd: 0,
          netObligationVnd: 0,
          prepaidVnd: 0
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
      },
      markContributionPaid: async (input) => {
        const note = typeof input.note === "string" ? input.note.trim() : "";
        const transaction: ManualGroupFundTransaction = {
          batchId: uid("batch"),
          entryId: uid("entry"),
          postedAt: input.postedAt ?? new Date().toISOString(),
          sourceType: "MANUAL_ADJUSTMENT",
          transactionType: "WITHDRAWAL",
          playerId: input.playerId,
          playerName: players.get(input.playerId)?.displayName ?? input.playerId,
          amountVnd: input.amountVnd,
          reason: note.length > 0 ? note : "Marked player paid into group fund"
        };

        manualGroupFundTransactions.unshift(transaction);

        return {
          batchId: transaction.batchId,
          postedAt: transaction.postedAt,
          playerId: transaction.playerId ?? input.playerId,
          playerName: transaction.playerName ?? input.playerId,
          amountVnd: transaction.amountVnd,
          note: note.length > 0 ? note : null
        };
      },
      createManualTransaction: async (input) => {
        const transaction: ManualGroupFundTransaction = {
          batchId: uid("batch"),
          entryId: uid("entry"),
          postedAt: input.postedAt ?? new Date().toISOString(),
          sourceType:
            input.transactionType === "ADJUSTMENT_IN" || input.transactionType === "ADJUSTMENT_OUT"
              ? "SYSTEM_CORRECTION"
              : "MANUAL_ADJUSTMENT",
          transactionType: input.transactionType,
          playerId: input.playerId ?? null,
          playerName: input.playerId ? players.get(input.playerId)?.displayName ?? null : null,
          amountVnd: input.amountVnd,
          reason: input.reason
        };

        manualGroupFundTransactions.unshift(transaction);
        return transaction;
      },
      listManualTransactions: async ({ transactionType, playerId, page, pageSize }) => {
        let items = [...manualGroupFundTransactions];
        if (transactionType) {
          items = items.filter((item) => item.transactionType === transactionType);
        }
        if (playerId) {
          items = items.filter((item) => item.playerId === playerId);
        }

        const start = (page - 1) * pageSize;
        return {
          items: items.slice(start, start + pageSize),
          total: items.length
        };
      }
    } as any
  };

  return services;
}
