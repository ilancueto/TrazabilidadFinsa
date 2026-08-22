import { afterEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureException }));

const originalEnv = { ...process.env };

describe("client error tracking bridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("does not capture while the public build gate is OFF", async () => {
    process.env.NEXT_PUBLIC_ERROR_TRACKING_ACTIVE = "false";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.invalid/1";
    const { captureClientException } = await import("@/lib/error-tracking/client");

    captureClientException(new Error("off"));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captures a client error once and skips server-digest errors", async () => {
    process.env.NEXT_PUBLIC_ERROR_TRACKING_ACTIVE = "true";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.invalid/1";
    const { captureClientException } = await import("@/lib/error-tracking/client");
    const error = new Error("client failure");

    captureClientException(error);
    captureClientException(error);
    captureClientException(Object.assign(new Error("server failure"), { digest: "digest-123" }));

    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("isolates a provider failure from rendering", async () => {
    process.env.NEXT_PUBLIC_ERROR_TRACKING_ACTIVE = "true";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.invalid/1";
    captureException.mockImplementation(() => {
      throw new Error("provider unavailable");
    });
    const { captureClientException } = await import("@/lib/error-tracking/client");

    expect(() => captureClientException(new Error("client failure"))).not.toThrow();
  });
});
