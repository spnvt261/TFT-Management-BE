import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { PoolClient } from "pg";
import { createPgPool } from "../postgres/pool.js";

export interface FlywayRunOptions {
  enabled: boolean;
  command: string;
  databaseUrl?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  locations?: string;
  cwd?: string;
}

async function isCommandAvailable(command: string, cwd?: string): Promise<boolean> {
  return await new Promise<boolean>((resolvePromise) => {
    const child = spawn(command, ["-v"], {
      cwd,
      stdio: "ignore",
      shell: process.platform === "win32"
    });

    child.once("error", () => resolvePromise(false));
    child.once("close", (code) => resolvePromise(code === 0));
  });
}

const DEFAULT_HISTORY_TABLE = "flyway_schema_history";
const MIGRATION_LOCK_ID = 10260327;
const versionedMigrationPattern = /^V(?<version>[0-9][0-9A-Za-z_.-]*)__+(?<description>.+)\.sql$/i;

function normalizeLocationPath(rawLocation: string, cwd?: string): string {
  const location = rawLocation.trim();
  if (location.startsWith("filesystem:")) {
    const filesystemPath = location.slice("filesystem:".length);
    return resolve(cwd ?? process.cwd(), filesystemPath);
  }
  return resolve(cwd ?? process.cwd(), location);
}

function resolveMigrationDirectory(locations: string | undefined, cwd?: string): string {
  if (locations === undefined || locations.trim().length === 0) {
    return resolve(cwd ?? process.cwd(), "db", "migrations");
  }

  const rawLocations = locations.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  const filesystemLocation =
    rawLocations.find((entry) => entry.startsWith("filesystem:")) ??
    rawLocations[0];

  if (filesystemLocation === undefined) {
    return resolve(cwd ?? process.cwd(), "db", "migrations");
  }

  return normalizeLocationPath(filesystemLocation, cwd);
}

function parseVersionTokens(version: string): number[] {
  return version
    .split(/[._-]/g)
    .map((token) => Number.parseInt(token, 10))
    .map((parsed) => (Number.isNaN(parsed) ? 0 : parsed));
}

function compareVersions(left: string, right: string): number {
  const leftTokens = parseVersionTokens(left);
  const rightTokens = parseVersionTokens(right);
  const total = Math.max(leftTokens.length, rightTokens.length);

  for (let index = 0; index < total; index += 1) {
    const leftToken = leftTokens[index] ?? 0;
    const rightToken = rightTokens[index] ?? 0;
    if (leftToken < rightToken) {
      return -1;
    }
    if (leftToken > rightToken) {
      return 1;
    }
  }

  return 0;
}

function toDescription(raw: string): string {
  return raw.replaceAll("_", " ").trim();
}

function crc32(value: string): number {
  let crc = 0 ^ -1;
  for (let index = 0; index < value.length; index += 1) {
    const byte = value.charCodeAt(index);
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) | 0;
}

interface VersionedMigration {
  filename: string;
  version: string;
  description: string;
  sql: string;
  checksum: number;
}

async function loadVersionedMigrations(directory: string): Promise<VersionedMigration[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      throw new Error(
        `Migration directory not found: ${directory}. ` +
          "If running on Vercel, ensure vercel.json includes apps/api/db/migrations/** in function includeFiles."
      );
    }
    throw error;
  }
  const migrations: VersionedMigration[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = versionedMigrationPattern.exec(entry.name);
    if (match === null || match.groups === undefined) {
      continue;
    }

    const version = match.groups.version;
    const rawDescription = match.groups.description;
    if (version === undefined || rawDescription === undefined) {
      continue;
    }
    const description = toDescription(rawDescription);
    const path = resolve(directory, entry.name);
    const sql = await readFile(path, "utf8");

    migrations.push({
      filename: entry.name,
      version,
      description,
      sql,
      checksum: crc32(sql)
    });
  }

  return migrations.sort((left, right) => compareVersions(left.version, right.version));
}

async function ensureSchemaHistoryTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${DEFAULT_HISTORY_TABLE} (
      installed_rank INTEGER PRIMARY KEY,
      version VARCHAR(50),
      description VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL,
      script VARCHAR(1000) NOT NULL,
      checksum INTEGER,
      installed_by VARCHAR(100) NOT NULL,
      installed_on TIMESTAMPTZ NOT NULL DEFAULT now(),
      execution_time INTEGER NOT NULL,
      success BOOLEAN NOT NULL
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS flyway_schema_history_success_idx
      ON ${DEFAULT_HISTORY_TABLE}(success)
  `);
}

interface AppliedMigration {
  version: string | null;
  script: string;
  checksum: number | null;
  success: boolean;
}

async function runNativeSqlMigrations(options: FlywayRunOptions): Promise<void> {
  const migrationDirectory = resolveMigrationDirectory(options.locations, options.cwd);
  const migrations = await loadVersionedMigrations(migrationDirectory);

  if (migrations.length === 0) {
    process.stdout.write(`[startup] No versioned migrations found in ${migrationDirectory}\n`);
    return;
  }

  const pool = createPgPool();
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await ensureSchemaHistoryTable(client);

    const appliedResult = await client.query<AppliedMigration>(
      `SELECT version, script, checksum, success FROM ${DEFAULT_HISTORY_TABLE} WHERE success = TRUE`
    );

    const appliedByVersion = new Map<string, AppliedMigration>();
    for (const applied of appliedResult.rows) {
      if (applied.version !== null) {
        appliedByVersion.set(applied.version, applied);
      }
    }

    for (const migration of migrations) {
      const applied = appliedByVersion.get(migration.version);

      if (applied !== undefined) {
        if (applied.checksum !== null && applied.checksum !== migration.checksum) {
          throw new Error(
            `Checksum mismatch for ${migration.filename} (version ${migration.version}). ` +
              "Migration file was changed after being applied."
          );
        }
        continue;
      }

      const startedAt = Date.now();
      await client.query("BEGIN");

      try {
        await client.query(migration.sql);

        const executionTime = Date.now() - startedAt;
        await client.query(
          `
          INSERT INTO ${DEFAULT_HISTORY_TABLE}(
            installed_rank, version, description, type, script, checksum, installed_by, execution_time, success
          )
          VALUES (
            (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM ${DEFAULT_HISTORY_TABLE}),
            $1, $2, 'SQL', $3, $4, CURRENT_USER, $5, TRUE
          )
          `,
          [migration.version, migration.description, migration.filename, migration.checksum, executionTime]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Failed applying migration ${migration.filename}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

export async function runFlywayMigrations(options: FlywayRunOptions): Promise<void> {
  if (!options.enabled) {
    return;
  }

  const hasFlyway = await isCommandAvailable(options.command, options.cwd);
  if (!hasFlyway) {
    process.stderr.write(
      `[startup] Flyway command "${options.command}" is not available. ` +
        "Falling back to built-in SQL migration runner.\n"
    );
    await runNativeSqlMigrations(options);
    return;
  }

  const defaultLocation = `filesystem:${resolve(options.cwd ?? process.cwd(), "db", "migrations")}`;
  const locations = options.locations ?? defaultLocation;
  const jdbcUrl =
    options.databaseUrl !== undefined && options.databaseUrl.length > 0
      ? `jdbc:${options.databaseUrl.replace(/^postgres(?:ql)?:/i, "postgresql:")}`
      : `jdbc:postgresql://${options.host}:${options.port}/${options.database}`;
  const args = [
    `-url=${jdbcUrl}`,
    `-locations=${locations}`,
    "migrate"
  ];

  if (options.databaseUrl === undefined || options.databaseUrl.length === 0) {
    args.splice(1, 0, `-user=${options.user}`, `-password=${options.password}`);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(options.command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.once("error", (error) => {
      rejectPromise(error);
    });

    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`Flyway failed with exit code ${code ?? -1}`));
    });
  });
}
