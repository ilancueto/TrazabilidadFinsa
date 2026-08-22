import { afterEach, describe, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ init }));

const originalEnv = { ...process.env };

describe("client Sentry initialization", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("does not initialize without the derived public gate", async () => {
    process.env.NEXT_PUBLIC_ERROR_TRACKING_ACTIVE = "false";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.invalid/1";

    await import("@/instrumentation-client");

    expect(init).not.toHaveBeenCalled();
  });

  it("uses the SDK's real no-default-integrations guardrail when enabled", async () => {
    process.env.NEXT_PUBLIC_ERROR_TRACKING_ACTIVE = "true";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.invalid/1";

    await import("@/instrumentation-client");

    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      defaultIntegrations: false,
      integrations: [],
      sendDefaultPii: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enableMetrics: false,
      enableLogs: false,
      maxBreadcrumbs: 0,
    }));
  });
});
