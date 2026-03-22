import type { Queryable } from "../postgres/transaction.js";
import type { PlayerRecord } from "../../domain/models/records.js";

export interface ListPlayersInput {
  groupId: string;
  isActive?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

export interface CreatePlayerInput {
  groupId: string;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface UpdatePlayerInput {
  displayName?: string;
  slug?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
}

function mapPlayer(row: {
  id: string;
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): PlayerRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    slug: row.slug,
    avatarUrl: row.avatar_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PlayerRepository {
  public constructor(private readonly db: Queryable) {}

  public async list(input: ListPlayersInput): Promise<{ items: PlayerRecord[]; total: number }> {
    const conditions: string[] = ["gm.group_id = $1"];
    const params: unknown[] = [input.groupId];

    if (input.isActive !== undefined) {
      params.push(input.isActive);
      conditions.push(`gm.is_active = $${params.length}`);
    }

    if (input.search) {
      params.push(`%${input.search.toLowerCase()}%`);
      conditions.push(`LOWER(p.display_name) LIKE $${params.length}`);
    }

    const whereSql = conditions.join(" AND ");

    const totalResult = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM players p
      INNER JOIN group_members gm ON gm.player_id = p.id
      WHERE ${whereSql}
      `,
      params
    );

    params.push(input.pageSize, (input.page - 1) * input.pageSize);

    const rows = await this.db.query<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT p.id, p.display_name, p.slug, p.avatar_url, gm.is_active, p.created_at, p.updated_at
      FROM players p
      INNER JOIN group_members gm ON gm.player_id = p.id
      WHERE ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );

    return {
      items: rows.rows.map(mapPlayer),
      total: Number(totalResult.rows[0]?.count ?? "0")
    };
  }

  public async create(input: CreatePlayerInput): Promise<PlayerRecord> {
    const result = await this.db.query<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO players(display_name, slug, avatar_url, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, display_name, slug, avatar_url, is_active, created_at, updated_at
      `,
      [input.displayName, input.slug, input.avatarUrl, input.isActive]
    );

    const player = result.rows[0]!;

    await this.db.query(
      `
      INSERT INTO group_members(group_id, player_id, is_primary, is_active)
      VALUES ($1, $2, TRUE, $3)
      ON CONFLICT (group_id, player_id) DO NOTHING
      `,
      [input.groupId, player.id, input.isActive]
    );

    return mapPlayer({
      ...player,
      is_active: input.isActive
    });
  }

  public async findById(playerId: string, groupId: string): Promise<PlayerRecord | null> {
    const result = await this.db.query<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT p.id, p.display_name, p.slug, p.avatar_url, gm.is_active, p.created_at, p.updated_at
      FROM players p
      INNER JOIN group_members gm ON gm.player_id = p.id AND gm.group_id = $2
      WHERE p.id = $1
      LIMIT 1
      `,
      [playerId, groupId]
    );

    const row = result.rows[0];
    return row ? mapPlayer(row) : null;
  }

  public async update(playerId: string, groupId: string, input: UpdatePlayerInput): Promise<PlayerRecord | null> {
    const membership = await this.db.query<{ is_active: boolean }>(
      `
      SELECT is_active
      FROM group_members
      WHERE group_id = $1 AND player_id = $2
      LIMIT 1
      `,
      [groupId, playerId]
    );

    if (!membership.rows[0]) {
      return null;
    }

    if (input.isActive !== undefined) {
      await this.db.query(
        `
        UPDATE group_members
        SET
          is_active = $3,
          left_at = CASE WHEN $3 = FALSE THEN COALESCE(left_at, now()) ELSE NULL END
        WHERE group_id = $1 AND player_id = $2
        `,
        [groupId, playerId, input.isActive]
      );
    }

    await this.db.query(
      `
      UPDATE players p
      SET
        display_name = COALESCE($2, p.display_name),
        slug = CASE WHEN $3::boolean THEN NULL ELSE COALESCE($4, p.slug) END,
        avatar_url = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($6, p.avatar_url) END,
        updated_at = now()
      WHERE p.id = $1
      `,
      [playerId, input.displayName ?? null, input.slug === null, input.slug ?? null, input.avatarUrl === null, input.avatarUrl ?? null]
    );

    const result = await this.db.query<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT p.id, p.display_name, p.slug, p.avatar_url, gm.is_active, p.created_at, p.updated_at
      FROM players p
      INNER JOIN group_members gm ON gm.player_id = p.id AND gm.group_id = $2
      WHERE p.id = $1
      LIMIT 1
      `,
      [playerId, groupId]
    );

    const row = result.rows[0];
    return row ? mapPlayer(row) : null;
  }

  public async softDelete(playerId: string, groupId: string): Promise<PlayerRecord | null> {
    const result = await this.db.query<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      WITH updated_membership AS (
        UPDATE group_members gm
        SET
          is_active = FALSE,
          left_at = COALESCE(gm.left_at, now())
        WHERE gm.group_id = $2 AND gm.player_id = $1
        RETURNING gm.player_id
      )
      SELECT p.id, p.display_name, p.slug, p.avatar_url, gm.is_active, p.created_at, p.updated_at
      FROM updated_membership um
      INNER JOIN players p ON p.id = um.player_id
      INNER JOIN group_members gm ON gm.player_id = p.id AND gm.group_id = $2
      LIMIT 1
      `,
      [playerId, groupId]
    );

    const row = result.rows[0];
    return row ? mapPlayer(row) : null;
  }

  public async findActiveByIds(groupId: string, playerIds: string[]): Promise<PlayerRecord[]> {
    if (playerIds.length === 0) {
      return [];
    }

    const result = await this.db.query<{
      id: string;
      display_name: string;
      slug: string | null;
      avatar_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT p.id, p.display_name, p.slug, p.avatar_url, gm.is_active, p.created_at, p.updated_at
      FROM players p
      INNER JOIN group_members gm ON gm.player_id = p.id AND gm.group_id = $1 AND gm.is_active = TRUE
      WHERE p.id = ANY($2::uuid[])
      `,
      [groupId, playerIds]
    );

    return result.rows.map(mapPlayer);
  }
}
