import { Client } from "pg";

export interface EnsureDatabaseOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  adminDatabase: string;
  targetDatabase: string;
  ssl?: boolean;
  enabled: boolean;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function ensureDatabaseExists(options: EnsureDatabaseOptions): Promise<"created" | "exists" | "skipped"> {
  if (!options.enabled) {
    return "skipped";
  }

  const client = new Client({
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    database: options.adminDatabase,
    ssl: options.ssl ? { rejectUnauthorized: false } : undefined
  });

  await client.connect();

  try {
    const existsResult = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [options.targetDatabase]
    );

    const exists = existsResult.rows[0]?.exists ?? false;
    if (exists) {
      return "exists";
    }

    try {
      await client.query(`CREATE DATABASE ${quoteIdentifier(options.targetDatabase)}`);
      return "created";
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P04") {
        return "exists";
      }
      throw error;
    }
  } finally {
    await client.end();
  }
}
