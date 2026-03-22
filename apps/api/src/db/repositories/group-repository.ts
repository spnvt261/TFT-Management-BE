import type { Queryable } from "../postgres/transaction.js";
import type { GroupRecord } from "../../domain/models/records.js";

export class GroupRepository {
  public constructor(private readonly db: Queryable) {}

  public async findByCode(code: string): Promise<GroupRecord | null> {
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      timezone: string;
      currency_code: string;
    }>(
      `
      SELECT id, code, name, timezone, currency_code
      FROM groups
      WHERE code = $1
      LIMIT 1
      `,
      [code]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      timezone: row.timezone,
      currencyCode: row.currency_code
    };
  }
}
