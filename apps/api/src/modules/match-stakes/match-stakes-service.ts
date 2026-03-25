import type { Pool } from "pg";
import { badRequest, conflict, notFound, unprocessable } from "../../core/errors/app-error.js";
import { withTransaction } from "../../db/postgres/transaction.js";
import { createRepositories, type RepositoryBundle } from "../../db/repositories/repository-factory.js";
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
  type: "MATCH" | "INITIAL";
  matchId: string | null;
  playedAt: string | null;
  matchNo: number | null;
  participantCount: number | null;
  status: string | null;
  rows: DebtPeriodTimelinePlayerRowItem[];
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

  public async getDebtPeriodTimeline(periodId: string, input?: { includeInitialSnapshot?: boolean }) {
    const period = await this.repositories.matchStakesDebt.getPeriodById(this.groupId, periodId);
    if (!period) {
      throw notFound("DEBT_PERIOD_NOT_FOUND", "Debt period not found");
    }

    const includeInitialSnapshot = input?.includeInitialSnapshot ?? true;
    const summary = await this.buildDebtPeriodSummary(this.repositories, period.id);

    const periodMatches = await this.repositories.matchStakesDebt.listNonVoidedPeriodMatches({
      groupId: this.groupId,
      debtPeriodId: period.id
    });

    const participants = await this.repositories.matchStakesDebt.listMatchParticipantsByMatchIds(
      periodMatches.map((match) => match.id)
    );

    const participantsByMatchId = new Map<string, typeof participants>();
    for (const participant of participants) {
      const current = participantsByMatchId.get(participant.matchId) ?? [];
      current.push(participant);
      participantsByMatchId.set(participant.matchId, current);
    }

    const playerScope: DebtPeriodTimelinePlayerScopeItem[] = summary.players.map((item) => ({
      playerId: item.playerId,
      playerName: item.playerName
    }));

    const initByPlayer = new Map(summary.players.map((item) => [item.playerId, item.initNetVnd]));
    const cumulativeByPlayer = new Map(playerScope.map((item) => [item.playerId, initByPlayer.get(item.playerId) ?? 0]));
    const timelineAscending: DebtPeriodTimelineItem[] = periodMatches.map((match, index) => {
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
        playedAt: match.playedAt,
        matchNo: match.periodMatchNo ?? index + 1,
        participantCount: match.participantCount,
        status: match.status,
        rows: sortTimelineRows(rows)
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
