import { spawn } from "node:child_process";
import { resolve } from "node:path";

export interface FlywayRunOptions {
  enabled: boolean;
  command: string;
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

export async function runFlywayMigrations(options: FlywayRunOptions): Promise<void> {
  if (!options.enabled) {
    return;
  }

  const hasFlyway = await isCommandAvailable(options.command, options.cwd);
  if (!hasFlyway) {
    // Keep local/dev startup unblocked on machines without Flyway CLI installed.
    process.stderr.write(
      `[startup] Flyway command "${options.command}" is not available. ` +
        "Skipping migration stage. Set FLYWAY_ENABLED=false to silence this warning.\n"
    );
    return;
  }

  const defaultLocation = `filesystem:${resolve(options.cwd ?? process.cwd(), "db", "migrations")}`;
  const locations = options.locations ?? defaultLocation;
  const args = [
    `-url=jdbc:postgresql://${options.host}:${options.port}/${options.database}`,
    `-user=${options.user}`,
    `-password=${options.password}`,
    `-locations=${locations}`,
    "migrate"
  ];

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
