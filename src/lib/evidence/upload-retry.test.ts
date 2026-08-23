import { describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_ATTEMPTS, uploadRetryDelayMs, uploadWithRetry } from "@/lib/evidence/upload-retry";

describe("upload retry instrumentation", () => {
  it("records a single operation through failure then success with the real 1s delay", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);

    await uploadWithRetry({ operationId: "op_test", send, wait });

    expect(send.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2]);
    expect(send.mock.calls.every(([, id]) => id === "op_test")).toBe(true);
    expect(wait).toHaveBeenCalledWith(1000);
  });

  it("uses attempts 1, 2, 3 with 1s then 2s and never schedules a 4s delay", async () => {
    const send = vi.fn().mockRejectedValue(new Error("413"));
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(uploadWithRetry({ operationId: "op_test", send, wait })).rejects.toThrow("413");

    expect(MAX_UPLOAD_ATTEMPTS).toBe(3);
    expect(send.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3]);
    expect(wait.mock.calls.map(([delay]) => delay)).toEqual([1000, 2000]);
    expect(wait).not.toHaveBeenCalledWith(4000);
  });

  it.each(["400", "401", "413"])("retries the current behavior for HTTP %s failures", async (status) => {
    const send = vi.fn().mockRejectedValue(new Error(status));
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(uploadWithRetry({ operationId: "op_test", send, wait })).rejects.toThrow(status);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("exposes only the two valid backoff intervals", () => {
    expect(uploadRetryDelayMs(1)).toBe(1000);
    expect(uploadRetryDelayMs(2)).toBe(2000);
    expect(uploadRetryDelayMs(3)).toBeNull();
  });
});
