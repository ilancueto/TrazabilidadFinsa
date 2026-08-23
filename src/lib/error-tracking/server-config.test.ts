import { afterEach, describe, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ init }));

const originalEnv = { ...process.env };

function enableStagingGate() {
  process.env.ERROR_TRACKING_ENABLED = "true";
  process.env.SENTRY_DSN = "https://server@example.invalid/1";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = "staging";
  delete process.env.CI;
}

describe("server Sentry initialization", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("does not initialize without the server gate", async () => {
    delete process.env.ERROR_TRACKING_ENABLED;
    delete process.env.SENTRY_DSN;

    await import("../../../sentry.server.config");

    expect(init).not.toHaveBeenCalled();
  });

  it("uses no default integrations, OTel, local variables, or server name", async () => {
    enableStagingGate();

    await import("../../../sentry.server.config");

    expect(init).toHaveBeenCalledWith(expect.objectContaining({
      defaultIntegrations: false,
      integrations: [],
      sendDefaultPii: false,
      enableMetrics: false,
      enableLogs: false,
      maxBreadcrumbs: 0,
      includeLocalVariables: false,
      includeServerName: false,
      registerEsmLoaderHooks: false,
      skipOpenTelemetrySetup: true,
    }));
    expect(init.mock.calls[0]?.[0]).not.toHaveProperty("tracesSampleRate");
  });
});
