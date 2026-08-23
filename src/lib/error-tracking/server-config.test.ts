import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventEnvelope, serializeEnvelope } from "@sentry/core";

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

  it("marks sanitized server events to prevent Relay IP inference", async () => {
    enableStagingGate();

    await import("../../../sentry.server.config");

    const beforeSend = init.mock.calls[0]?.[0]?.beforeSend as ((event: unknown) => unknown) | undefined;
    expect(beforeSend).toBeTypeOf("function");

    const event = beforeSend?.({
      exception: { values: [{ type: "Error", value: "safe error" }] },
      user: { ip_address: "203.0.113.10", geo: { city: "must-not-send" } },
      contexts: { trace: { trace_id: "must-not-send", span_id: "must-not-send" } },
    });

    expect((event as { sdk?: unknown }).sdk).toEqual({
      settings: { infer_ip: "never" },
    });
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("contexts");

    const serializedEnvelope = serializeEnvelope(createEventEnvelope(event as Parameters<typeof createEventEnvelope>[0]));
    expect(serializedEnvelope).toContain('"infer_ip":"never"');
    expect(serializedEnvelope).not.toContain("must-not-send");
  });
});
