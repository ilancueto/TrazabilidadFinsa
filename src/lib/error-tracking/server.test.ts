import { afterEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureException }));

const originalEnv = { ...process.env };

function enableStagingGate() {
  process.env.ERROR_TRACKING_ENABLED = "true";
  process.env.SENTRY_DSN = "https://server@example.invalid/1";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = "staging";
  delete process.env.CI;
}

describe("server error tracking bridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("does nothing while the gate is OFF", async () => {
    delete process.env.ERROR_TRACKING_ENABLED;
    delete process.env.SENTRY_DSN;
    const { captureServerException } = await import("@/lib/error-tracking/server");
    captureServerException(new Error("off"));
    await Promise.resolve();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captures only an Error and allowlisted tags when active", async () => {
    enableStagingGate();
    const { captureServerException } = await import("@/lib/error-tracking/server");
    const error = new Error("password=do-not-send");
    captureServerException(error, {
      code: "evidence.upload_failed",
      route: "/api/evidence",
      requestId: "request-123",
    });

    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: {
        code: "evidence.upload_failed",
        route: "/api/evidence",
        requestId: "request-123",
      },
    });
  });

  it("isolates synchronous and rejected provider failures", async () => {
    enableStagingGate();
    captureException.mockImplementationOnce(() => {
      throw new Error("provider unavailable");
    }).mockRejectedValueOnce(new Error("transport unavailable"));
    const { captureServerException } = await import("@/lib/error-tracking/server");

    expect(() => captureServerException(new Error("first"))).not.toThrow();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());
    expect(() => captureServerException(new Error("second"))).not.toThrow();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(2));
  });
});
