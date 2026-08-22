import { afterEach, describe, expect, it, vi } from "vitest";

const { captureServerException } = vi.hoisted(() => ({ captureServerException: vi.fn() }));

vi.mock("@/lib/error-tracking/server", () => ({ captureServerException }));

const originalEnv = { ...process.env };

function enableStagingGate() {
  process.env.ERROR_TRACKING_ENABLED = "true";
  process.env.SENTRY_DSN = "https://server@example.invalid/1";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = "staging";
  delete process.env.CI;
}

describe("onRequestError adapter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("does not call the provider while OFF", async () => {
    delete process.env.ERROR_TRACKING_ENABLED;
    const { onRequestError } = await import("@/instrumentation");
    onRequestError(new Error("off"), {
      path: "/api/evidence?token=do-not-send",
      method: "POST",
      headers: { authorization: "Bearer do-not-send" },
    }, { routePath: "/api/evidence", routeType: "route" } as never);

    expect(captureServerException).not.toHaveBeenCalled();
  });

  it("extracts only safe request facts while active", async () => {
    enableStagingGate();
    const { onRequestError } = await import("@/instrumentation");
    onRequestError(Object.assign(new Error("failure"), { digest: "digest-123" }), {
      path: "/api/evidence?token=do-not-send",
      method: "POST",
      headers: {
        authorization: "Bearer do-not-send",
        cookie: "session=do-not-send",
        "x-request-id": "incoming-123",
      },
    }, { routePath: "/api/evidence?token=do-not-send", routeType: "route" } as never);

    expect(captureServerException).toHaveBeenCalledWith(expect.any(Error), {
      route: "/api/evidence",
      digest: "digest-123",
      requestId: "incoming-123",
      method: "POST",
      routeType: "route",
      runtime: "nodejs",
    });
    expect(JSON.stringify(captureServerException.mock.calls[0])).not.toContain("do-not-send");
  });
});
