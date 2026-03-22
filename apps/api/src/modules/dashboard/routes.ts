import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { errorResponseSchemas, successResponseSchema } from "../../core/docs/swagger.js";

const dashboardOverviewResponseSchema = z.object({
  playerCount: z.number().int().nonnegative(),
  totalMatches: z.number().int().nonnegative(),
  matchStakes: z.object({
    totalMatches: z.number().int().nonnegative(),
    topPlayers: z.array(
      z.object({
        playerId: uuidSchema,
        playerName: z.string(),
        totalNetVnd: z.number().int()
      })
    )
  }),
  groupFund: z.object({
    totalMatches: z.number().int().nonnegative(),
    fundBalanceVnd: z.number().int(),
    topContributors: z.array(
      z.object({
        playerId: uuidSchema,
        playerName: z.string(),
        totalContributedVnd: z.number().int()
      })
    )
  }),
  recentMatches: z.array(
    z.object({
      id: uuidSchema,
      module: z.enum(["MATCH_STAKES", "GROUP_FUND"]),
      playedAt: z.string(),
      participantCount: z.number().int(),
      ruleSetId: uuidSchema,
      ruleSetName: z.string(),
      ruleSetVersionId: uuidSchema,
      ruleSetVersionNo: z.number().int().positive(),
      notePreview: z.string().nullable(),
      status: z.string(),
      participants: z.array(
        z.object({
          playerId: uuidSchema,
          playerName: z.string(),
          tftPlacement: z.number().int(),
          relativeRank: z.number().int(),
          settlementNetVnd: z.number().int()
        })
      ),
      totalTransferVnd: z.number().int(),
      totalFundInVnd: z.number().int(),
      totalFundOutVnd: z.number().int(),
      createdAt: z.string()
    })
  )
});

export async function registerDashboardRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/dashboard/overview",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Get dashboard overview",
        response: {
          200: successResponseSchema(dashboardOverviewResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async () => {
      const [players, allMatches, matchStakesSummary, matchStakesMatches, groupFundSummary, groupFundMatches, recentMatches] =
        await Promise.all([
          services.players.list({ page: 1, pageSize: 1, search: undefined, isActive: undefined }),
          services.matches.listMatches({ page: 1, pageSize: 1 }),
          services.matchStakes.getSummary({}),
          services.matches.listMatches({ module: "MATCH_STAKES", page: 1, pageSize: 1 }),
          services.groupFund.getSummary({}),
          services.matches.listMatches({ module: "GROUP_FUND", page: 1, pageSize: 1 }),
          services.matches.listMatches({ page: 1, pageSize: 5 })
        ]);

      const topMatchStakesPlayers = [...matchStakesSummary.players]
        .sort((a, b) => b.totalNetVnd - a.totalNetVnd)
        .slice(0, 5)
        .map((player) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          totalNetVnd: player.totalNetVnd
        }));

      const topFundContributors = [...groupFundSummary.players]
        .sort((a, b) => b.totalContributedVnd - a.totalContributedVnd)
        .slice(0, 5)
        .map((player) => ({
          playerId: player.playerId,
          playerName: player.playerName,
          totalContributedVnd: player.totalContributedVnd
        }));

      return ok({
        playerCount: players.total,
        totalMatches: allMatches.total,
        matchStakes: {
          totalMatches: matchStakesMatches.total,
          topPlayers: topMatchStakesPlayers
        },
        groupFund: {
          totalMatches: groupFundMatches.total,
          fundBalanceVnd: groupFundSummary.fundBalanceVnd,
          topContributors: topFundContributors
        },
        recentMatches: recentMatches.items
      });
    }
  );
}
