import type { Queryable } from "../postgres/transaction.js";
import type { RoleRecord } from "../../domain/models/records.js";

function mapRole(row: {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
}): RoleRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class RoleRepository {
  public constructor(private readonly db: Queryable) {}

  public async findByCode(code: string): Promise<RoleRecord | null> {
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, code, name, created_at, updated_at
      FROM roles
      WHERE code = $1
      LIMIT 1
      `,
      [code]
    );

    const row = result.rows[0];
    return row ? mapRole(row) : null;
  }
}
