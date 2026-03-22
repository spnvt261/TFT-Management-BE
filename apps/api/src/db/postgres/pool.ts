import { Pool } from "pg";
import { env } from "../../core/config/env.js";

export function createPgPool(): Pool {
  return new Pool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    ssl: env.db.ssl ? { rejectUnauthorized: false } : undefined,
    max: 20
  });
}
