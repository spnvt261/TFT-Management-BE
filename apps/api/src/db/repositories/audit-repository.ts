import type { Queryable } from "../postgres/transaction.js";

export class AuditRepository {
  public constructor(private readonly db: Queryable) {}

  public async insert(input: {
    groupId: string;
    entityType: string;
    entityId: string;
    actionType: string;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO audit_logs(group_id, entity_type, entity_id, action_type, before_json, after_json, metadata_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [input.groupId, input.entityType, input.entityId, input.actionType, input.before ?? null, input.after ?? null, input.metadata ?? null]
    );
  }
}
