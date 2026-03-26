import { Pool, types } from "pg";
import { env } from "../../core/config/env.js";

const PG_INT8_OID = 20;

function parsePgInt8(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`PG int8 value is outside JS safe integer range: ${value}`);
  }

  return parsed;
}

export function createPgPool(): Pool {
  // Parse BIGINT columns as numbers so API response schemas expecting integers remain valid.
  types.setTypeParser(PG_INT8_OID, parsePgInt8);

  const ssl = env.db.ssl ? { rejectUnauthorized: false } : undefined;

  if (env.db.url !== undefined && env.db.url.length > 0) {
    return new Pool({
      connectionString: env.db.url,
      ssl,
      max: 20
    });
  }

  return new Pool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ssl,
    max: 20
  });
}
