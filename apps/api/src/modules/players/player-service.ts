import { conflict, notFound } from "../../core/errors/app-error.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";

export class PlayerService {
  public constructor(private readonly repositories: RepositoryBundle, private readonly groupId: string) {}

  public list(input: { isActive?: boolean; search?: string; page: number; pageSize: number }) {
    return this.repositories.players.list({
      groupId: this.groupId,
      isActive: input.isActive,
      search: input.search,
      page: input.page,
      pageSize: input.pageSize
    });
  }

  public async create(input: { displayName: string; slug: string | null; avatarUrl: string | null; isActive: boolean }) {
    try {
      return await this.repositories.players.create({
        groupId: this.groupId,
        displayName: input.displayName,
        slug: input.slug,
        avatarUrl: input.avatarUrl,
        isActive: input.isActive
      });
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
        throw conflict("PLAYER_DUPLICATE", "Player slug must be unique");
      }
      throw error;
    }
  }

  public async getById(playerId: string) {
    const player = await this.repositories.players.findById(playerId, this.groupId);
    if (!player) {
      throw notFound("PLAYER_NOT_FOUND", "Player not found");
    }
    return player;
  }

  public async update(
    playerId: string,
    input: { displayName?: string; slug?: string | null; avatarUrl?: string | null; isActive?: boolean }
  ) {
    const player = await this.repositories.players.update(playerId, this.groupId, input);
    if (!player) {
      throw notFound("PLAYER_NOT_FOUND", "Player not found");
    }
    return player;
  }

  public async softDelete(playerId: string) {
    const player = await this.repositories.players.softDelete(playerId, this.groupId);
    if (!player) {
      throw notFound("PLAYER_NOT_FOUND", "Player not found");
    }
    return player;
  }
}
