import { describe, expect, it, vi } from "vitest";
import { withTransaction } from "../src/db/postgres/transaction.js";

describe("transaction helper", () => {
  it("commits on success", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();

    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release })
    } as any;

    const result = await withTransaction(pool, async (client) => {
      await client.query("SELECT 1");
      return "ok";
    });

    expect(result).toBe("ok");
    expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(query).toHaveBeenNthCalledWith(2, "SELECT 1");
    expect(query).toHaveBeenNthCalledWith(3, "COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rolls back on failure", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();

    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release })
    } as any;

    await expect(
      withTransaction(pool, async (client) => {
        await client.query("INSERT INTO test VALUES (1)");
      })
    ).rejects.toThrow("boom");

    expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(query).toHaveBeenNthCalledWith(2, "INSERT INTO test VALUES (1)");
    expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });
});
