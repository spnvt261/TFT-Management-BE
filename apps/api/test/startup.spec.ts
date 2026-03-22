import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureDatabaseExists = vi.fn();
const runFlywayMigrations = vi.fn();
const createPgPool = vi.fn();
const buildServices = vi.fn();
const createApp = vi.fn();

vi.mock("../src/db/bootstrap/ensure-database.js", () => ({
  ensureDatabaseExists
}));

vi.mock("../src/db/migrations/flyway-runner.js", () => ({
  runFlywayMigrations
}));

vi.mock("../src/db/postgres/pool.js", () => ({
  createPgPool
}));

vi.mock("../src/core/types/container.js", () => ({
  buildServices
}));

vi.mock("../src/app.js", () => ({
  createApp
}));

describe("startup lifecycle", () => {
  const pool = {
    end: vi.fn()
  };

  const app = {
    addHook: vi.fn(),
    listen: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ensureDatabaseExists.mockResolvedValue("created");
    runFlywayMigrations.mockResolvedValue(undefined);
    createPgPool.mockReturnValue(pool);
    buildServices.mockResolvedValue({});
    createApp.mockResolvedValue(app);
  });

  it("creates missing DB, runs Flyway, then starts app", async () => {
    ensureDatabaseExists.mockResolvedValue("created");

    const { bootstrapAndStart } = await import("../src/main.js");
    await bootstrapAndStart();

    expect(ensureDatabaseExists).toHaveBeenCalledTimes(1);
    expect(runFlywayMigrations).toHaveBeenCalledTimes(1);
    expect(buildServices).toHaveBeenCalledTimes(1);
    expect(createApp).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledTimes(1);
  });

  it("is no-op safe when DB already exists and still runs migrations", async () => {
    ensureDatabaseExists.mockResolvedValue("exists");

    const { bootstrapAndStart } = await import("../src/main.js");
    await bootstrapAndStart();

    expect(ensureDatabaseExists).toHaveBeenCalledTimes(1);
    expect(runFlywayMigrations).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledTimes(1);
  });

  it("does not start app when migrations fail", async () => {
    runFlywayMigrations.mockRejectedValue(new Error("migration failure"));

    const { bootstrapAndStart } = await import("../src/main.js");

    await expect(bootstrapAndStart()).rejects.toThrow("migration failure");
    expect(createPgPool).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
  });
});
