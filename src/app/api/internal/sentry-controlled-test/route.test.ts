import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(),
  getClient: vi.fn(),
}));
const config = vi.hoisted(() => ({ isServerErrorTrackingEnabled: vi.fn() }));

vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/lib/error-tracking/config", () => config);

import { HEAD, POST } from "@/app/api/internal/sentry-controlled-test/route";

const URL = "https://staging.invalid/api/internal/sentry-controlled-test";

function request(nonce = "valid-nonce", body?: string): Request {
  return new Request(URL, {
    method: "POST",
    headers: {
      "content-length": body === undefined ? "0" : String(new TextEncoder().encode(body).byteLength),
      "x-sentry-controlled-test-nonce": nonce,
    },
    ...(body === undefined ? {} : { body }),
  });
}

describe("controlled Sentry STAGING endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("SENTRY_CONTROLLED_TEST_NONCE", "valid-nonce");
    config.isServerErrorTrackingEnabled.mockReturnValue(true);
    sentry.getClient.mockReturnValue({});
    sentry.flush.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reports only authenticated preflight booleans without capturing", () => {
    const response = HEAD(new Request(URL, {
      method: "HEAD",
      headers: { "x-sentry-controlled-test-nonce": "valid-nonce" },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-sentry-probe-gate")).toBe("enabled");
    expect(response.headers.get("x-sentry-probe-client")).toBe("ready");
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
  });

  it("reports disabled and missing states without side effects", () => {
    config.isServerErrorTrackingEnabled.mockReturnValue(false);
    sentry.getClient.mockReturnValue(undefined);
    const response = HEAD(new Request(URL, {
      method: "HEAD",
      headers: { "x-sentry-controlled-test-nonce": "valid-nonce" },
    }));

    expect(response.headers.get("x-sentry-probe-gate")).toBe("disabled");
    expect(response.headers.get("x-sentry-probe-client")).toBe("missing");
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.flush).not.toHaveBeenCalled();
  });

  it("keeps preflight fail-closed without a valid nonce", () => {
    const response = HEAD(new Request(URL, { method: "HEAD" }));

    expect(response.status).toBe(404);
    expect(response.headers.has("x-sentry-probe-gate")).toBe(false);
    expect(response.headers.has("x-sentry-probe-client")).toBe(false);
  });

  it("fails closed when tracking is disabled", async () => {
    config.isServerErrorTrackingEnabled.mockReturnValue(false);

    expect((await POST(request())).status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejects a request with a body", async () => {
    expect((await POST(request("valid-nonce", "unexpected"))).status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejects body-related transport headers", async () => {
    const withLength = request();
    withLength.headers.set("content-length", "1");
    expect((await POST(withLength)).status).toBe(404);

    const chunked = request();
    chunked.headers.set("transfer-encoding", "chunked");
    expect((await POST(chunked)).status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejects a POST without an explicit zero content length", async () => {
    const withoutLength = request();
    withoutLength.headers.delete("content-length");

    expect((await POST(withoutLength)).status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid nonce", async () => {
    expect((await POST(request("invalid-nonce"))).status).toBe(404);
    vi.stubEnv("SENTRY_CONTROLLED_TEST_NONCE", "");
    expect((await POST(request())).status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("fails closed when the Sentry client is not initialized", async () => {
    sentry.getClient.mockReturnValue(undefined);

    expect((await POST(request())).status).toBe(404);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("captures exactly one fixed event and flushes it", async () => {
    expect((await POST(request())).status).toBe(204);
    expect(sentry.captureException).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: {
        code: "error_tracking.controlled_test",
        method: "POST",
        routeType: "route",
        runtime: "nodejs",
      },
    });
    expect(sentry.captureException.mock.calls[0]?.[0]).toMatchObject({
      message: "Controlled Sentry STAGING validation",
    });
    expect(sentry.flush).toHaveBeenCalledOnce();
    expect(sentry.flush).toHaveBeenCalledWith(2_000);
  });

  it("does not retry when flushing is ambiguous", async () => {
    sentry.flush.mockResolvedValue(false);

    expect((await POST(request())).status).toBe(503);
    expect(sentry.captureException).toHaveBeenCalledOnce();
    expect(sentry.flush).toHaveBeenCalledOnce();
  });
});
