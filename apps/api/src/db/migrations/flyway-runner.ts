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

export async function runFlywayMigrations(options: FlywayRunOptions): Promise<void> {
  if (!options.enabled) {
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
