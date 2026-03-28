import type { Pool } from "pg";
import { badRequest, conflict, notFound, unprocessable } from "../../core/errors/app-error.js";
import { withTransaction } from "../../db/postgres/transaction.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
import type { MatchStakesImpactMode } from "../../domain/models/enums.js";
import type { MatchStakesDebtPeriodRecord } from "../../domain/models/records.js";

interface DebtPeriodPlayerSummaryItem {
  playerId: string;
  playerName: string;
  totalMatches: number;
  initNetVnd: number;
  accruedNetVnd: number;
  settledPaidVnd: number;
  settledReceivedVnd: number;
  outstandingNetVnd: number;
}

interface DebtPeriodSummarySnapshot {
  totalMatches: number;
  totalPlayers: number;
  totalOutstandingReceiveVnd: number;
  totalOutstandingPayVnd: number;
}

interface DebtPeriodTimelinePlayerScopeItem {
  playerId: string;
  playerName: string;
}

interface DebtPeriodTimelinePlayerRowItem {
  playerId: string;
  playerName: string;
  tftPlacement: number | null;
  relativeRank: number | null;
  matchNetVnd: number;
  cumulativeNetVnd: number;
}

interface DebtPeriodTimelineItem {
  type: "MATCH" | "INITIAL" | "ADVANCE" | "NOTE";
  matchId: string | null;
  eventId: string | null;
  eventType: string | null;
  playedAt: string | null;
  matchNo: number | null;
  participantCount: number | null;
  status: string | null;
  amountVnd: number | null;
  note: string | null;
  affectsDebt: boolean | null;
  impactMode: MatchStakesImpactMode | null;
  metadata: unknown | null;
  rows: DebtPeriodTimelinePlayerRowItem[];
}

interface MatchStakesHistoryItem {
  id: string;
  module: "MATCH_STAKES";
  itemType: string;
  eventStatus: "ACTIVE" | "RESET" | null;
  resetAt: string | null;
  resetReason: string | null;
  postedAt: string;
  createdAt: string;
  title: string;
  description: string | null;
  amountVnd: number | null;
  player: {
    id: string;
    name: string;
  } | null;
  secondaryPlayer: {
    id: string;
    name: string;
  } | null;
  matchId: string | null;
  debtPeriodId: string | null;
  ledgerBatchId: string | null;
  balanceBeforeVnd: number | null;
  balanceAfterVnd: number | null;
  outstandingBeforeVnd: number | null;
  outstandingAfterVnd: number | null;
  note: string | null;
  metadata: unknown;
}

function toPeriodDto(period: MatchStakesDebtPeriodRecord) {
  return {
    id: period.id,
    periodNo: period.periodNo,
    title: period.title,
    note: period.note,
    closeNote: period.closeNote,
    nextPeriodId: period.nextPeriodId,
    status: period.status,
    openedAt: period.openedAt,
    closedAt: period.closedAt
  };
}

function sortPlayers(items: DebtPeriodPlayerSummaryItem[]): DebtPeriodPlayerSummaryItem[] {
  return [...items].sort((left, right) => {
    const leftBucket = left.outstandingNetVnd > 0 ? 0 : left.outstandingNetVnd === 0 ? 1 : 2;
    const rightBucket = right.outstandingNetVnd > 0 ? 0 : right.outstandingNetVnd === 0 ? 1 : 2;

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

    if (leftBucket === 0 && left.outstandingNetVnd !== right.outstandingNetVnd) {
      return right.outstandingNetVnd - left.outstandingNetVnd;
    }

    if (leftBucket === 2 && left.outstandingNetVnd !== right.outstandingNetVnd) {
      return left.outstandingNetVnd - right.outstandingNetVnd;
    }

    const byName = left.playerName.localeCompare(right.playerName);
    if (byName !== 0) {
      return byName;
    }

    return left.playerId.localeCompare(right.playerId);
  });
}

function sortTimelineRows(rows: DebtPeriodTimelinePlayerRowItem[]): DebtPeriodTimelinePlayerRowItem[] {
  return [...rows].sort((left, right) => {
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
}

function toMatchStakesHistoryItem(input: {
  id: string;
  itemType: string;
  eventStatus: "ACTIVE" | "RESET" | null;
  resetAt: string | null;
  resetReason: string | null;
  postedAt: string;
  createdAt: string;
  title: string;
  description: string | null;
  amountVnd: number | null;
  playerId: string | null;
  playerName: string | null;
  secondaryPlayerId: string | null;
  secondaryPlayerName: string | null;
  matchId: string | null;
  debtPeriodId: string | null;
  ledgerBatchId: string | null;
  balanceBeforeVnd: number | null;
  balanceAfterVnd: number | null;
  outstandingBeforeVnd: number | null;
  outstandingAfterVnd: number | null;
  note: string | null;
  metadata: unknown;
}): MatchStakesHistoryItem {
  return {
    id: input.id,
    module: "MATCH_STAKES",
    itemType: input.itemType,
    eventStatus: input.eventStatus,
    resetAt: input.resetAt,
    resetReason: input.resetReason,
    postedAt: input.postedAt,
    createdAt: input.createdAt,
    title: input.title,
    description: input.description,
    amountVnd: input.amountVnd,
    player: input.playerId
      ? {
          id: input.playerId,
          name: input.playerName ?? input.playerId
        }
      : null,
    secondaryPlayer: input.secondaryPlayerId
      ? {
          id: input.secondaryPlayerId,
          name: input.secondaryPlayerName ?? input.secondaryPlayerId
        }
      : null,
    matchId: input.matchId,
    debtPeriodId: input.debtPeriodId,
    ledgerBatchId: input.ledgerBatchId,
    balanceBeforeVnd: input.balanceBeforeVnd,
    balanceAfterVnd: input.balanceAfterVnd,
    outstandingBeforeVnd: input.outstandingBeforeVnd,
    outstandingAfterVnd: input.outstandingAfterVnd,
    note: input.note,
    metadata: input.metadata
  };
}

export class MatchStakesService {
  public constructor(
    private readonly pool: Pool,
    private readonly repositories: RepositoryBundle,
    private readonly groupId: string
  ) {}

  public async getSummary(input: { from?: string; to?: string }) {
    const players = await this.repositories.ledgers.getMatchStakesSummary(this.groupId, input.from, input.to);
    const matches = await this.repositories.matches.list({
      groupId: this.groupId,
      module: "MATCH_STAKES",
      from: input.from,
      to: input.to,
      page: 1,
      pageSize: 1
    });

    return {
      module: "MATCH_STAKES" as const,
      players,
      debtSuggestions: [],
      totalMatches: matches.total,
      range: {
        from: input.from ?? null,
        to: input.to ?? null
      }
    };
  }

  public async getCurrentDebtPeriod() {
    const period = await this.repositories.matchStakesDebt.getCurrentOpenPeriod(this.groupId);
    if (!period) {
      throw notFound("DEBT_PERIOD_NOT_FOUND", "No open debt period found");
    }

    const summary = await this.buildDebtPeriodSummary(this.repositories, period.id);

    return {
      period: toPeriodDto(period),
      summary: summary.summary,
      players: summary.players
    };
  }

  public async listDebtPeriods(input: { page: number; pageSize: number }) {
    const periods = await this.repositories.matchStakesDebt.listPeriods({
      groupId: this.groupId,
      page: input.page,
      pageSize: input.pageSize
    });

    const items = await Promise.all(
      periods.items.map(async (period) => {
        const summary = await this.buildDebtPeriodSummary(this.repositories, period.id);
        return {
          ...toPeriodDto(period),
          ...summary.summary
        };
      })
    );

    return {
      items,
      total: periods.total
    };
  }

  public async getDebtPeriodDetail(periodId: string) {
    const period = await this.repositories.matchStakesDebt.getPeriodById(this.groupId, periodId);
    if (!period) {
      throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
    }

    const [summary, settlements, recentMatches] = await Promise.all([
      this.buildDebtPeriodSummary(this.repositories, period.id),
      this.repositories.matchStakesDebt.listSettlementsWithLines({
        groupId: this.groupId,
        debtPeriodId: period.id
      }),
      this.repositories.matches.list({
        groupId: this.groupId,
        module: "MATCH_STAKES",
        periodId: period.id,
        page: 1,
        pageSize: 20
      })
    ]);

    return {
      period: toPeriodDto(period),
      summary: summary.summary,
      players: summary.players,
      settlements,
      recentMatches: recentMatches.items.map((match) => ({
        id: match.id,
        playedAt: match.played_at,
        participantCount: match.participant_count,
        status: match.status,
        debtPeriodId: match.debt_period_id,
        debtPeriodNo: match.debt_period_no ?? null,
        periodMatchNo: match.period_match_no ?? null
      }))
    };
  }

  public async getHistory(input: {
    periodId?: string;
    playerId?: string;
    from?: string;
    to?: string;
    itemTypes?: string[];
    page: number;
    pageSize: number;
  }) {
    const result = await this.repositories.historyEvents.listMatchStakesHistory({
      groupId: this.groupId,
      periodId: input.periodId,
      playerId: input.playerId,
      from: input.from,
      to: input.to,
      itemTypes: input.itemTypes,
      page: input.page,
      pageSize: input.pageSize
    });

    return {
      items: result.items.map((item) =>
        toMatchStakesHistoryItem({
          id: item.id,
          itemType: item.itemType,
          eventStatus: item.eventStatus,
          resetAt: item.resetAt,
          resetReason: item.resetReason,
          postedAt: item.postedAt,
          createdAt: item.createdAt,
          title: item.title,
          description: item.description,
          amountVnd: item.amountVnd,
          playerId: item.playerId,
          playerName: item.playerName,
          secondaryPlayerId: item.secondaryPlayerId,
          secondaryPlayerName: item.secondaryPlayerName,
          matchId: item.matchId,
          debtPeriodId: item.debtPeriodId,
          ledgerBatchId: item.ledgerBatchId,
          balanceBeforeVnd: item.balanceBeforeVnd,
          balanceAfterVnd: item.balanceAfterVnd,
          outstandingBeforeVnd: item.outstandingBeforeVnd,
          outstandingAfterVnd: item.outstandingAfterVnd,
          note: item.note,
          metadata: item.metadata
        })
      ),
      total: result.total
    };
  }

  public async getDebtPeriodTimeline(periodId: string, input?: { includeInitialSnapshot?: boolean }) {
    const period = await this.repositories.matchStakesDebt.getPeriodById(this.groupId, periodId);
    if (!period) {
      throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
    }

    const includeInitialSnapshot = input?.includeInitialSnapshot ?? true;
    const summary = await this.buildDebtPeriodSummary(this.repositories, period.id);

    const [periodMatches, periodEvents] = await Promise.all([
      this.repositories.matchStakesDebt.listNonVoidedPeriodMatches({
        groupId: this.groupId,
        debtPeriodId: period.id
      }),
      this.repositories.historyEvents.listMatchStakesPeriodEvents({
        groupId: this.groupId,
        periodId: period.id
      })
    ]);

    const [participants, eventImpacts] = await Promise.all([
      this.repositories.matchStakesDebt.listMatchParticipantsByMatchIds(periodMatches.map((match) => match.id)),
      this.repositories.historyEvents.listMatchStakesPeriodEventImpacts(periodEvents.map((event) => event.id))
    ]);

    const participantsByMatchId = new Map<string, typeof participants>();
    for (const participant of participants) {
      const current = participantsByMatchId.get(participant.matchId) ?? [];
      current.push(participant);
      participantsByMatchId.set(participant.matchId, current);
    }

    const impactsByEventId = new Map<string, typeof eventImpacts>();
    for (const impact of eventImpacts) {
      const current = impactsByEventId.get(impact.historyEventId) ?? [];
      current.push(impact);
      impactsByEventId.set(impact.historyEventId, current);
    }

    const playerScope: DebtPeriodTimelinePlayerScopeItem[] = summary.players.map((item) => ({
      playerId: item.playerId,
      playerName: item.playerName
    }));

    const initByPlayer = new Map(summary.players.map((item) => [item.playerId, item.initNetVnd]));
    const cumulativeByPlayer = new Map(playerScope.map((item) => [item.playerId, initByPlayer.get(item.playerId) ?? 0]));
    const matchById = new Map(periodMatches.map((match) => [match.id, match]));
    const eventById = new Map(periodEvents.map((event) => [event.id, event]));
    const fallbackMatchNoById = new Map(periodMatches.map((match, index) => [match.id, match.periodMatchNo ?? index + 1]));
    const timelineEntries = [
      ...periodMatches.map((match) => ({
        kind: "MATCH" as const,
        id: match.id,
        postedAt: match.playedAt,
        createdAt: match.createdAt
      })),
      ...periodEvents.map((event) => ({
        kind: "EVENT" as const,
        id: event.id,
        postedAt: event.postedAt,
        createdAt: event.createdAt
      }))
    ].sort((left, right) => {
      const byPostedAt = new Date(left.postedAt).getTime() - new Date(right.postedAt).getTime();
      if (byPostedAt !== 0) {
        return byPostedAt;
      }

      const byCreatedAt = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }

      return left.id.localeCompare(right.id);
    });

    const timelineAscending: DebtPeriodTimelineItem[] = timelineEntries.map((entry) => {
      if (entry.kind === "MATCH") {
        const match = matchById.get(entry.id);
        if (!match) {
          return {
            type: "MATCH" as const,
            matchId: entry.id,
            eventId: null,
            eventType: null,
            playedAt: entry.postedAt,
            matchNo: null,
            participantCount: null,
            status: null,
            amountVnd: null,
            note: null,
            affectsDebt: null,
            impactMode: null,
            metadata: null,
            rows: sortTimelineRows(
              playerScope.map((player) => ({
                playerId: player.playerId,
                playerName: player.playerName,
                tftPlacement: null,
                relativeRank: null,
                matchNetVnd: 0,
                cumulativeNetVnd: cumulativeByPlayer.get(player.playerId) ?? 0
              }))
            )
          };
        }

        const matchParticipants = participantsByMatchId.get(match.id) ?? [];
        const participantByPlayerId = new Map(matchParticipants.map((participant) => [participant.playerId, participant]));

        const rows = playerScope.map((player) => {
          const participant = participantByPlayerId.get(player.playerId);
          const matchNetVnd = participant?.settlementNetVnd ?? 0;
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
        });

        return {
          type: "MATCH" as const,
          matchId: match.id,
          eventId: null,
          eventType: null,
          playedAt: match.playedAt,
          matchNo: fallbackMatchNoById.get(match.id) ?? null,
          participantCount: match.participantCount,
          status: match.status,
          amountVnd: null,
          note: null,
          affectsDebt: null,
          impactMode: null,
          metadata: null,
          rows: sortTimelineRows(rows)
        };
      }

      const event = eventById.get(entry.id);
      const impactRows = event ? impactsByEventId.get(event.id) ?? [] : [];
      const impactByPlayerId = new Map(impactRows.map((impact) => [impact.playerId, impact.netDeltaVnd]));

      const rows = playerScope.map((player) => {
        const eventNetVnd = impactByPlayerId.get(player.playerId) ?? 0;
        const cumulativeNetVnd = (cumulativeByPlayer.get(player.playerId) ?? 0) + eventNetVnd;
        cumulativeByPlayer.set(player.playerId, cumulativeNetVnd);

        return {
          playerId: player.playerId,
          playerName: player.playerName,
          tftPlacement: null,
          relativeRank: null,
          matchNetVnd: eventNetVnd,
          cumulativeNetVnd
        };
      });

      return {
        type: event?.eventType === "MATCH_STAKES_ADVANCE" ? ("ADVANCE" as const) : ("NOTE" as const),
        matchId: null,
        eventId: event?.id ?? entry.id,
        eventType: event?.eventType ?? null,
        playedAt: event?.postedAt ?? entry.postedAt,
        matchNo: null,
        participantCount: null,
        status: event?.eventStatus ?? null,
        amountVnd: event?.amountVnd ?? null,
        note: event?.note ?? null,
        affectsDebt: event?.affectsDebt ?? null,
        impactMode: event?.impactMode ?? null,
        metadata: event?.metadata ?? null,
        rows: sortTimelineRows(rows)
      };
    });

    const timeline = [...timelineAscending].reverse();
    if (includeInitialSnapshot) {
      timeline.push({
        type: "INITIAL" as const,
        matchId: null,
        eventId: null,
        eventType: null,
        playedAt: null,
        matchNo: null,
        participantCount: null,
        status: null,
        amountVnd: null,
        note: null,
        affectsDebt: null,
        impactMode: null,
        metadata: null,
        rows: sortTimelineRows(
          playerScope.map((player) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            tftPlacement: null,
            relativeRank: null,
            matchNetVnd: initByPlayer.get(player.playerId) ?? 0,
            cumulativeNetVnd: initByPlayer.get(player.playerId) ?? 0
          }))
        )
      });
    }

    return {
      period: toPeriodDto(period),
      summary: summary.summary,
      currentPlayers: summary.players,
      timeline
    };
  }

  public async createHistoryEvent(input: {
    eventType: "MATCH_STAKES_ADVANCE" | "MATCH_STAKES_NOTE";
    postedAt?: string;
    note?: string | null;
    playerId?: string;
    amountVnd?: number;
    impactMode?: MatchStakesImpactMode;
    participantPlayerIds?: string[];
    beneficiaryPlayerIds?: string[];
    debtPeriodId?: string;
    createdByRoleCode?: string | null;
  }) {
    const postedAt = input.postedAt ?? new Date().toISOString();

    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const period = input.debtPeriodId
        ? await txRepositories.matchStakesDebt.getPeriodById(this.groupId, input.debtPeriodId)
        : await txRepositories.matchStakesDebt.getCurrentOpenPeriod(this.groupId);

      if (!period) {
        throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
      }

      if (period.status !== "OPEN") {
        throw unprocessable("DEBT_PERIOD_NOT_OPEN", "Debt period is not open");
      }

      if (input.eventType === "MATCH_STAKES_NOTE") {
        const normalizedNote = input.note?.trim() ?? "";
        if (normalizedNote.length === 0) {
          throw badRequest("MATCH_STAKES_HISTORY_EVENT_INVALID", "note is required for MATCH_STAKES_NOTE");
        }

        let playerNameById = new Map<string, string>();
        if (input.playerId) {
          const players = await txRepositories.players.findActiveByIds(this.groupId, [input.playerId]);
          if (players.length !== 1) {
            throw unprocessable("MATCH_STAKES_HISTORY_EVENT_INVALID", "playerId must be an active group member");
          }
          playerNameById = new Map(players.map((player) => [player.id, player.displayName]));
        }

        const createdEvent = await txRepositories.historyEvents.createEvent({
          groupId: this.groupId,
          module: "MATCH_STAKES",
          eventType: "MATCH_STAKES_NOTE",
          postedAt,
          note: normalizedNote,
          amountVnd: null,
          matchStakesImpactMode: "INFORMATIONAL",
          affectsDebt: false,
          playerId: input.playerId ?? null,
          secondaryPlayerId: null,
          debtPeriodId: period.id,
          matchId: null,
          ledgerBatchId: null,
          balanceBeforeVnd: null,
          balanceAfterVnd: null,
          outstandingBeforeVnd: null,
          outstandingAfterVnd: null,
          metadataJson: {},
          createdByRoleCode: input.createdByRoleCode ?? null
        });

        await txRepositories.audits.insert({
          groupId: this.groupId,
          entityType: "MATCH_STAKES_HISTORY_EVENT",
          entityId: createdEvent.id,
          actionType: "CREATE",
          after: {
            eventType: createdEvent.eventType,
            debtPeriodId: period.id,
            playerId: createdEvent.playerId,
            note: createdEvent.note
          }
        });

        const summary = await this.buildDebtPeriodSummary(txRepositories, period.id);
        return {
          period: toPeriodDto(period),
          event: this.mapCreatedHistoryEvent(createdEvent, playerNameById),
          summary: summary.summary,
          players: summary.players
        };
      }

      const advancerPlayerId = input.playerId;
      if (!advancerPlayerId) {
        throw badRequest("MATCH_STAKES_ADVANCE_INVALID", "playerId is required for MATCH_STAKES_ADVANCE");
      }
      if (!Number.isInteger(input.amountVnd) || (input.amountVnd ?? 0) <= 0) {
        throw badRequest("MATCH_STAKES_ADVANCE_INVALID", "amountVnd must be a positive integer");
      }

      const amountVnd = input.amountVnd!;
      const impactMode = input.impactMode ?? "AFFECTS_DEBT";
      const advancer = await txRepositories.players.findActiveByIds(this.groupId, [advancerPlayerId]);
      if (advancer.length !== 1) {
        throw unprocessable("MATCH_STAKES_ADVANCE_INVALID", "playerId must be an active group member");
      }

      const playerNameById = new Map([[advancer[0]!.id, advancer[0]!.displayName]]);
      if (impactMode === "INFORMATIONAL") {
        const createdEvent = await txRepositories.historyEvents.createEvent({
          groupId: this.groupId,
          module: "MATCH_STAKES",
          eventType: "MATCH_STAKES_ADVANCE",
          postedAt,
          note: input.note?.trim() ?? null,
          amountVnd,
          matchStakesImpactMode: "INFORMATIONAL",
          affectsDebt: false,
          playerId: advancerPlayerId,
          secondaryPlayerId: null,
          debtPeriodId: period.id,
          matchId: null,
          ledgerBatchId: null,
          balanceBeforeVnd: null,
          balanceAfterVnd: null,
          outstandingBeforeVnd: null,
          outstandingAfterVnd: null,
          metadataJson: {
            impactMode: "INFORMATIONAL"
          },
          createdByRoleCode: input.createdByRoleCode ?? null
        });

        await txRepositories.audits.insert({
          groupId: this.groupId,
          entityType: "MATCH_STAKES_HISTORY_EVENT",
          entityId: createdEvent.id,
          actionType: "CREATE",
          after: {
            eventType: createdEvent.eventType,
            debtPeriodId: period.id,
            playerId: createdEvent.playerId,
            amountVnd: createdEvent.amountVnd,
            impactMode
          }
        });

        const summary = await this.buildDebtPeriodSummary(txRepositories, period.id);
        return {
          period: toPeriodDto(period),
          event: this.mapCreatedHistoryEvent(createdEvent, playerNameById),
          summary: summary.summary,
          players: summary.players
        };
      }

      const legacyBeneficiaryPlayerIds =
        input.beneficiaryPlayerIds && input.beneficiaryPlayerIds.length > 0 ? [...new Set(input.beneficiaryPlayerIds)] : null;

      const participantPlayerIds =
        input.participantPlayerIds && input.participantPlayerIds.length > 0
          ? [...input.participantPlayerIds]
          : legacyBeneficiaryPlayerIds
            ? [...new Set([...legacyBeneficiaryPlayerIds, advancerPlayerId])]
            : [];

      if (participantPlayerIds.length === 0) {
        throw badRequest(
          "MATCH_STAKES_ADVANCE_PARTICIPANTS_INVALID",
          "participantPlayerIds is required for MATCH_STAKES_ADVANCE when impactMode is AFFECTS_DEBT"
        );
      }

      if (new Set(participantPlayerIds).size !== participantPlayerIds.length) {
        throw badRequest("MATCH_STAKES_ADVANCE_PARTICIPANTS_INVALID", "participantPlayerIds must not contain duplicates");
      }

      if (!participantPlayerIds.includes(advancerPlayerId)) {
        throw badRequest(
          "MATCH_STAKES_ADVANCE_ADVANCER_NOT_IN_PARTICIPANTS",
          "playerId must be included in participantPlayerIds"
        );
      }

      const participantPlayers = await txRepositories.players.findActiveByIds(this.groupId, participantPlayerIds);
      if (participantPlayers.length !== participantPlayerIds.length) {
        throw unprocessable(
          "MATCH_STAKES_ADVANCE_PARTICIPANTS_INVALID",
          "All participantPlayerIds must be active group members"
        );
      }

      for (const player of participantPlayers) {
        playerNameById.set(player.id, player.displayName);
      }

      const beforeSummary = await this.buildDebtPeriodSummary(txRepositories, period.id);
      const outstandingByPlayerId = new Map(beforeSummary.players.map((player) => [player.playerId, player.outstandingNetVnd]));
      const impactLines = this.buildAdvanceImpactLines({
        advancerPlayerId,
        participantPlayerIds,
        amountVnd
      });
      const impactLinesForDebt = impactLines.map((line) => ({
        playerId: line.playerId,
        netDeltaVnd: line.netDeltaVnd
      }));
      const totalNetDeltaVnd = impactLinesForDebt.reduce((sum, line) => sum + line.netDeltaVnd, 0);
      if (totalNetDeltaVnd !== 0) {
        throw unprocessable("MATCH_STAKES_ADVANCE_INVALID", "Advance impact lines must net to zero");
      }

      const advancerNetDeltaVnd = impactLinesForDebt.find((line) => line.playerId === advancerPlayerId)?.netDeltaVnd ?? 0;

      const createdEvent = await txRepositories.historyEvents.createEvent({
        groupId: this.groupId,
        module: "MATCH_STAKES",
        eventType: "MATCH_STAKES_ADVANCE",
        postedAt,
        note: input.note?.trim() ?? null,
        amountVnd,
        matchStakesImpactMode: "AFFECTS_DEBT",
        affectsDebt: true,
        playerId: advancerPlayerId,
        secondaryPlayerId: null,
        debtPeriodId: period.id,
        matchId: null,
        ledgerBatchId: null,
        balanceBeforeVnd: null,
        balanceAfterVnd: null,
        outstandingBeforeVnd: outstandingByPlayerId.get(advancerPlayerId) ?? 0,
        outstandingAfterVnd: (outstandingByPlayerId.get(advancerPlayerId) ?? 0) + advancerNetDeltaVnd,
        metadataJson: {
          impactMode: "AFFECTS_DEBT",
          advancerPlayerId,
          participantPlayerIds,
          participantCount: participantPlayerIds.length,
          legacyBeneficiaryPlayerIds,
          impactLines
        },
        createdByRoleCode: input.createdByRoleCode ?? null
      });

      await txRepositories.historyEvents.insertMatchStakesImpacts(createdEvent.id, this.groupId, period.id, impactLinesForDebt);

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "MATCH_STAKES_HISTORY_EVENT",
        entityId: createdEvent.id,
        actionType: "CREATE",
        after: {
          eventType: createdEvent.eventType,
          debtPeriodId: period.id,
          playerId: createdEvent.playerId,
          amountVnd: createdEvent.amountVnd,
          impactMode: "AFFECTS_DEBT",
          participantPlayerIds,
          participantCount: participantPlayerIds.length,
          impactLines
        }
      });

      const summary = await this.buildDebtPeriodSummary(txRepositories, period.id);
      return {
        period: toPeriodDto(period),
        event: this.mapCreatedHistoryEvent(createdEvent, playerNameById),
        summary: summary.summary,
        players: summary.players
      };
    });
  }

  public async resetHistoryEvent(
    eventId: string,
    input: {
      reason?: string | null;
      resetByRoleCode?: string | null;
    }
  ) {
    const normalizedReason = input.reason?.trim() ? input.reason.trim() : null;

    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const existingEvent = await txRepositories.historyEvents.getEventById(this.groupId, eventId);
      if (!existingEvent) {
        throw notFound("MATCH_STAKES_HISTORY_EVENT_NOT_FOUND", "History event not found");
      }

      if (existingEvent.module !== "MATCH_STAKES") {
        throw unprocessable("MATCH_STAKES_HISTORY_EVENT_INVALID", "History event is not a match-stakes event");
      }

      if (existingEvent.eventType !== "MATCH_STAKES_ADVANCE") {
        throw unprocessable("MATCH_STAKES_HISTORY_EVENT_INVALID", "Only MATCH_STAKES_ADVANCE events can be reset");
      }

      if (existingEvent.eventStatus === "RESET") {
        throw conflict("MATCH_STAKES_HISTORY_EVENT_ALREADY_RESET", "History event has already been reset");
      }

      if (!existingEvent.debtPeriodId) {
        throw unprocessable("MATCH_STAKES_HISTORY_EVENT_INVALID", "History event is missing debt period");
      }

      const period = await txRepositories.matchStakesDebt.getPeriodById(this.groupId, existingEvent.debtPeriodId);
      if (!period) {
        throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
      }

      const resetEvent = await txRepositories.historyEvents.markEventReset({
        groupId: this.groupId,
        eventId: existingEvent.id,
        resetReason: normalizedReason
      });

      if (!resetEvent) {
        throw conflict("MATCH_STAKES_HISTORY_EVENT_ALREADY_RESET", "History event has already been reset");
      }

      const participantIds = this.extractParticipantPlayerIdsFromMetadata(resetEvent.metadataJson);
      const playerIdCandidates = new Set<string>([
        ...(resetEvent.playerId ? [resetEvent.playerId] : []),
        ...(resetEvent.secondaryPlayerId ? [resetEvent.secondaryPlayerId] : []),
        ...participantIds
      ]);
      const playerIds = [...playerIdCandidates];
      const relatedPlayers = playerIds.length > 0 ? await txRepositories.players.findActiveByIds(this.groupId, playerIds) : [];
      const playerNameById = new Map(relatedPlayers.map((player) => [player.id, player.displayName]));

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "MATCH_STAKES_HISTORY_EVENT",
        entityId: resetEvent.id,
        actionType: "RESET",
        before: {
          eventStatus: existingEvent.eventStatus,
          resetAt: existingEvent.resetAt,
          resetReason: existingEvent.resetReason
        },
        after: {
          eventStatus: resetEvent.eventStatus,
          resetAt: resetEvent.resetAt,
          resetReason: resetEvent.resetReason
        },
        metadata: {
          resetByRoleCode: input.resetByRoleCode ?? null
        }
      });

      const summary = await this.buildDebtPeriodSummary(txRepositories, period.id);
      return {
        period: toPeriodDto(period),
        event: this.mapCreatedHistoryEvent(resetEvent, playerNameById),
        summary: summary.summary,
        players: summary.players
      };
    });
  }

  public async createDebtPeriod(input: { title?: string | null; note?: string | null }) {
    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const existingOpen = await txRepositories.matchStakesDebt.getCurrentOpenPeriod(this.groupId);
      if (existingOpen) {
        throw conflict("DEBT_PERIOD_OPEN_ALREADY_EXISTS", "An open debt period already exists for this group");
      }

      const period = await txRepositories.matchStakesDebt.createOpenPeriod({
        groupId: this.groupId,
        title: input.title ?? null,
        note: input.note ?? null
      });

      return toPeriodDto(period);
    });
  }

  public async createDebtSettlement(
    periodId: string,
    input: {
      postedAt?: string;
      note?: string | null;
      lines: Array<{
        payerPlayerId: string;
        receiverPlayerId: string;
        amountVnd: number;
        note?: string | null;
      }>;
    }
  ) {
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw badRequest("DEBT_SETTLEMENT_INVALID", "Settlement lines must not be empty");
    }

    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const period = await txRepositories.matchStakesDebt.getPeriodById(this.groupId, periodId);
      if (!period) {
        throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
      }
      if (period.status !== "OPEN") {
        throw unprocessable("DEBT_PERIOD_NOT_OPEN", "Debt period is not open");
      }

      const allPlayerIds = new Set<string>();
      for (const line of input.lines) {
        if (line.payerPlayerId === line.receiverPlayerId) {
          throw badRequest("DEBT_SETTLEMENT_INVALID", "payerPlayerId and receiverPlayerId must be different");
        }
        if (!Number.isInteger(line.amountVnd) || line.amountVnd <= 0) {
          throw badRequest("DEBT_SETTLEMENT_INVALID", "amountVnd must be a positive integer");
        }
        allPlayerIds.add(line.payerPlayerId);
        allPlayerIds.add(line.receiverPlayerId);
      }

      const activePlayers = await txRepositories.players.findActiveByIds(this.groupId, [...allPlayerIds]);
      if (activePlayers.length !== allPlayerIds.size) {
        throw unprocessable("DEBT_SETTLEMENT_INVALID", "All players in settlement lines must be active group members");
      }

      const beforeSummary = await this.buildDebtPeriodSummary(txRepositories, period.id);
      const outstandingByPlayer = new Map(beforeSummary.players.map((item) => [item.playerId, item.outstandingNetVnd]));
      const deltaByPlayer = new Map<string, number>();

      for (const line of input.lines) {
        deltaByPlayer.set(line.payerPlayerId, (deltaByPlayer.get(line.payerPlayerId) ?? 0) + line.amountVnd);
        deltaByPlayer.set(line.receiverPlayerId, (deltaByPlayer.get(line.receiverPlayerId) ?? 0) - line.amountVnd);
      }

      for (const [playerId, delta] of deltaByPlayer.entries()) {
        const before = outstandingByPlayer.get(playerId) ?? 0;
        const after = before + delta;

        if (before === 0 && after !== 0) {
          throw unprocessable("DEBT_SETTLEMENT_OVERPAY", "Settlement would move a zero-outstanding player away from zero", {
            playerId,
            beforeOutstandingNetVnd: before,
            attemptedDeltaVnd: delta,
            afterOutstandingNetVnd: after
          });
        }

        if (before !== 0) {
          if (after !== 0 && Math.sign(after) !== Math.sign(before)) {
            throw unprocessable("DEBT_SETTLEMENT_OVERPAY", "Settlement would overshoot outstanding balance", {
              playerId,
              beforeOutstandingNetVnd: before,
              attemptedDeltaVnd: delta,
              afterOutstandingNetVnd: after
            });
          }

          if (Math.abs(after) > Math.abs(before)) {
            throw unprocessable("DEBT_SETTLEMENT_OVERPAY", "Settlement would increase outstanding balance in the wrong direction", {
              playerId,
              beforeOutstandingNetVnd: before,
              attemptedDeltaVnd: delta,
              afterOutstandingNetVnd: after
            });
          }
        }
      }

      const settlement = await txRepositories.matchStakesDebt.createSettlement({
        groupId: this.groupId,
        debtPeriodId: period.id,
        postedAt: input.postedAt ?? new Date().toISOString(),
        note: input.note ?? null
      });

      const insertedLines = await txRepositories.matchStakesDebt.insertSettlementLines(
        settlement.id,
        period.id,
        input.lines.map((line) => ({
          payerPlayerId: line.payerPlayerId,
          receiverPlayerId: line.receiverPlayerId,
          amountVnd: line.amountVnd,
          note: line.note ?? null
        }))
      );

      const playerNameById = new Map(activePlayers.map((player) => [player.id, player.displayName]));
      const updatedSummary = await this.buildDebtPeriodSummary(txRepositories, period.id);

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "MATCH_STAKES_DEBT_SETTLEMENT",
        entityId: settlement.id,
        actionType: "CREATE",
        after: {
          periodId: period.id,
          postedAt: settlement.postedAt,
          lines: insertedLines.map((line) => ({
            payerPlayerId: line.payerPlayerId,
            receiverPlayerId: line.receiverPlayerId,
            amountVnd: line.amountVnd
          }))
        }
      });

      return {
        settlement: {
          id: settlement.id,
          postedAt: settlement.postedAt,
          note: settlement.note,
          createdAt: settlement.createdAt,
          updatedAt: settlement.updatedAt,
          lines: insertedLines.map((line) => ({
            id: line.id,
            payerPlayerId: line.payerPlayerId,
            payerPlayerName: playerNameById.get(line.payerPlayerId) ?? line.payerPlayerId,
            receiverPlayerId: line.receiverPlayerId,
            receiverPlayerName: playerNameById.get(line.receiverPlayerId) ?? line.receiverPlayerId,
            amountVnd: line.amountVnd,
            note: line.note,
            createdAt: line.createdAt
          }))
        },
        summary: updatedSummary.summary,
        players: updatedSummary.players
      };
    });
  }

  public async closeDebtPeriod(
    periodId: string,
    input: {
      note?: string | null;
      closingBalances: Array<{
        playerId: string;
        netVnd: number;
      }>;
    }
  ) {
    return withTransaction(this.pool, async (tx) => {
      const txRepositories = createRepositories(tx);
      const period = await txRepositories.matchStakesDebt.getPeriodById(this.groupId, periodId);
      if (!period) {
        throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
      }
      if (period.status !== "OPEN") {
        throw unprocessable("DEBT_PERIOD_NOT_OPEN", "Debt period is not open");
      }

      const summary = await this.buildDebtPeriodSummary(txRepositories, period.id);
      const submittedBalances = input.closingBalances ?? [];
      const seen = new Set<string>();
      for (const item of submittedBalances) {
        if (seen.has(item.playerId)) {
          throw badRequest("DEBT_PERIOD_CLOSING_BALANCE_INVALID", "closingBalances contains duplicate playerId");
        }
        seen.add(item.playerId);
      }

      const playerById = new Map(summary.players.map((item) => [item.playerId, item]));
      for (const item of submittedBalances) {
        if (!playerById.has(item.playerId)) {
          throw badRequest(
            "DEBT_PERIOD_CLOSING_BALANCE_INVALID",
            "closingBalances contains playerId outside the current debt-period scope",
            {
              playerId: item.playerId
            }
          );
        }
      }

      const closeNote = input.note?.trim() ? input.note.trim() : null;
      const normalizedByPlayer = new Map(summary.players.map((item) => [item.playerId, 0]));
      for (const item of submittedBalances) {
        normalizedByPlayer.set(item.playerId, item.netVnd);
      }

      const normalizedClosingBalances = summary.players.map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        netVnd: normalizedByPlayer.get(player.playerId) ?? 0
      }));
      const totalClosingNetVnd = normalizedClosingBalances.reduce((sum, item) => sum + item.netVnd, 0);
      if (totalClosingNetVnd !== 0) {
        throw unprocessable("DEBT_PERIOD_CLOSING_BALANCE_INVALID", "closingBalances must net to zero", {
          totalClosingNetVnd
        });
      }

      const closingSnapshot = {
        submittedBalances: submittedBalances.map((item) => ({
          playerId: item.playerId,
          netVnd: item.netVnd
        })),
        normalizedBalances: normalizedClosingBalances,
        outstandingBeforeClose: summary.players.map((item) => ({
          playerId: item.playerId,
          playerName: item.playerName,
          outstandingNetVnd: item.outstandingNetVnd
        }))
      };

      const closedPeriod = await txRepositories.matchStakesDebt.closeOpenPeriod({
        groupId: this.groupId,
        periodId: period.id,
        closeNote,
        closingSnapshot,
        nextPeriodId: null
      });
      if (!closedPeriod) {
        throw unprocessable("DEBT_PERIOD_NOT_OPEN", "Debt period is not open");
      }

      const nextPeriod = await txRepositories.matchStakesDebt.createOpenPeriod({
        groupId: this.groupId,
        title: null,
        note: null
      });

      await txRepositories.matchStakesDebt.replacePeriodInitBalances(
        nextPeriod.id,
        normalizedClosingBalances.map((item) => ({
          playerId: item.playerId,
          initNetVnd: item.netVnd
        }))
      );

      await txRepositories.matchStakesDebt.setNextPeriodId(period.id, nextPeriod.id);

      await txRepositories.audits.insert({
        groupId: this.groupId,
        entityType: "MATCH_STAKES_DEBT_PERIOD",
        entityId: period.id,
        actionType: "CLOSE",
        after: {
          status: "CLOSED",
          closedAt: closedPeriod.closedAt,
          note: closeNote,
          nextPeriodId: nextPeriod.id,
          submittedBalances: submittedBalances.map((item) => ({
            playerId: item.playerId,
            netVnd: item.netVnd
          }))
        }
      });

      return {
        id: closedPeriod.id,
        status: closedPeriod.status,
        closedAt: closedPeriod.closedAt,
        nextPeriod: toPeriodDto(nextPeriod),
        carryForwardBalances: normalizedClosingBalances
      };
    });
  }

  public async getLedger(input: { playerId?: string; from?: string; to?: string; page: number; pageSize: number }) {
    return this.repositories.ledgers.listLedgerByModule({
      groupId: this.groupId,
      module: "MATCH_STAKES",
      playerId: input.playerId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  public getMatches(input: {
    playerId?: string;
    ruleSetId?: string;
    periodId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }) {
    return this.repositories.matches.list({
      groupId: this.groupId,
      module: "MATCH_STAKES",
      playerId: input.playerId,
      ruleSetId: input.ruleSetId,
      periodId: input.periodId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  private mapCreatedHistoryEvent(
    event: {
      id: string;
      eventType: string;
      eventStatus: "ACTIVE" | "RESET";
      resetAt: string | null;
      resetReason: string | null;
      postedAt: string;
      createdAt: string;
      note: string | null;
      amountVnd: number | null;
      playerId: string | null;
      secondaryPlayerId: string | null;
      debtPeriodId: string | null;
      ledgerBatchId: string | null;
      balanceBeforeVnd: number | null;
      balanceAfterVnd: number | null;
      outstandingBeforeVnd: number | null;
      outstandingAfterVnd: number | null;
      metadataJson: unknown;
    },
    playerNameById: Map<string, string>
  ): MatchStakesHistoryItem {
    return toMatchStakesHistoryItem({
      id: event.id,
      itemType: event.eventType === "MATCH_STAKES_ADVANCE" ? "ADVANCE" : "NOTE",
      eventStatus: event.eventStatus,
      resetAt: event.resetAt,
      resetReason: event.resetReason,
      postedAt: event.postedAt,
      createdAt: event.createdAt,
      title:
        event.eventType === "MATCH_STAKES_ADVANCE"
          ? `Advance by ${event.playerId ? (playerNameById.get(event.playerId) ?? event.playerId) : "Unknown"}`
          : "Operational note",
      description: event.note,
      amountVnd: event.amountVnd,
      playerId: event.playerId,
      playerName: event.playerId ? (playerNameById.get(event.playerId) ?? event.playerId) : null,
      secondaryPlayerId: event.secondaryPlayerId,
      secondaryPlayerName: event.secondaryPlayerId ? (playerNameById.get(event.secondaryPlayerId) ?? event.secondaryPlayerId) : null,
      matchId: null,
      debtPeriodId: event.debtPeriodId,
      ledgerBatchId: event.ledgerBatchId,
      balanceBeforeVnd: event.balanceBeforeVnd,
      balanceAfterVnd: event.balanceAfterVnd,
      outstandingBeforeVnd: event.outstandingBeforeVnd,
      outstandingAfterVnd: event.outstandingAfterVnd,
      note: event.note,
      metadata: this.withEventStateMetadata(event.metadataJson, event)
    });
  }

  private withEventStateMetadata(
    metadata: unknown,
    event: {
      eventStatus: "ACTIVE" | "RESET";
      resetAt: string | null;
      resetReason: string | null;
    }
  ): unknown {
    if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
      return {
        ...(metadata as Record<string, unknown>),
        eventStatus: event.eventStatus,
        resetAt: event.resetAt,
        resetReason: event.resetReason
      };
    }

    return {
      details: metadata,
      eventStatus: event.eventStatus,
      resetAt: event.resetAt,
      resetReason: event.resetReason
    };
  }

  private extractParticipantPlayerIdsFromMetadata(metadata: unknown): string[] {
    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
      return [];
    }

    const candidate = (metadata as { participantPlayerIds?: unknown }).participantPlayerIds;
    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate.filter((value): value is string => typeof value === "string");
  }

  private buildAdvanceImpactLines(input: {
    advancerPlayerId: string;
    participantPlayerIds: string[];
    amountVnd: number;
  }): Array<{ playerId: string; allocatedShareVnd: number; netDeltaVnd: number }> {
    const participantIds = [...input.participantPlayerIds].sort((left, right) => left.localeCompare(right));
    const baseShare = Math.floor(input.amountVnd / participantIds.length);
    const remainder = input.amountVnd % participantIds.length;

    return participantIds.map((playerId, index) => {
      const allocatedShareVnd = baseShare + (index < remainder ? 1 : 0);
      const netDeltaVnd = (playerId === input.advancerPlayerId ? input.amountVnd : 0) - allocatedShareVnd;
      return {
        playerId,
        allocatedShareVnd,
        netDeltaVnd
      };
    });
  }

  private async buildDebtPeriodSummary(
    repositories: RepositoryBundle,
    periodId: string
  ): Promise<{
    summary: DebtPeriodSummarySnapshot;
    players: DebtPeriodPlayerSummaryItem[];
  }> {
    const [aggregates, totalMatches] = await Promise.all([
      repositories.matchStakesDebt.listPeriodPlayerAggregates(this.groupId, periodId),
      repositories.matchStakesDebt.countNonVoidedMatchesInPeriod(this.groupId, periodId)
    ]);

    const players = sortPlayers(
      aggregates.map((item) => ({
        playerId: item.playerId,
        playerName: item.playerName,
        totalMatches: item.totalMatches,
        initNetVnd: item.initNetVnd,
        accruedNetVnd: item.accruedNetVnd,
        settledPaidVnd: item.settledPaidVnd,
        settledReceivedVnd: item.settledReceivedVnd,
        outstandingNetVnd: item.initNetVnd + item.accruedNetVnd - item.settledReceivedVnd + item.settledPaidVnd
      }))
    );

    const summary: DebtPeriodSummarySnapshot = {
      totalMatches,
      totalPlayers: players.length,
      totalOutstandingReceiveVnd: players
        .filter((item) => item.outstandingNetVnd > 0)
        .reduce((sum, item) => sum + item.outstandingNetVnd, 0),
      totalOutstandingPayVnd: players
        .filter((item) => item.outstandingNetVnd < 0)
        .reduce((sum, item) => sum + Math.abs(item.outstandingNetVnd), 0)
    };

    return {
      summary,
      players
    };
  }
}
