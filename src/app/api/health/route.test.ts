import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEALTH_TIMEOUT_MS } from "@/lib/health";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getPublicSupabaseConfig: vi.fn(),
  getRequestLogContext: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/env", () => ({ getPublicSupabaseConfig: mocks.getPublicSupabaseConfig }));
vi.mock("@/lib/observability", () => ({
  getRequestLogContext: mocks.getRequestLogContext,
  logServerError: mocks.logServerError,
}));

import { GET } from "@/app/api/health/route";

const request = (requestId?: string) =>
  new Request("https://cat.local/api/health", {
    headers: requestId ? { "x-request-id": requestId } : undefined,
  });

function client(options: {
  database?: Promise<{ error: Error | null }>;
  storage?: Promise<{ error: Error | null }>;
} = {}) {
  const retry = vi.fn().mockReturnValue(options.database ?? Promise.resolve({ error: null }));
  const abortSignal = vi.fn().mockReturnValue({ retry });
  const limit = vi.fn().mockReturnValue({ abortSignal });
  const select = vi.fn().mockReturnValue({ limit });

  return {
    from: vi.fn().mockReturnValue({ select }),
    storage: {
      getBucket: vi.fn().mockReturnValue(options.storage ?? Promise.resolve({ error: null })),
    },
  };
}

function configureHealthy() {
  mocks.getPublicSupabaseConfig.mockReturnValue({
    url: "https://project.supabase.test",
    anonKey: "anon-test-key",
  });
  mocks.createAdminClient.mockReturnValue(client());
  mocks.getRequestLogContext.mockImplementation((input: Request) => ({
    requestId: input.headers.get("x-request-id") ?? "generated-request-id",
    route: "/api/health",
  }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureHealthy();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the public healthy contract without logging", async () => {
    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(body).toMatchObject({
      ok: true,
      database: "reachable",
      auth: "reachable",
      storage: "reachable",
      service: "cat-trazabilidad",
    });
    expect(body).toHaveProperty("databaseLatencyMs");
    expect(body).toHaveProperty("time");
    expect(JSON.stringify(body)).not.toContain("anon-test-key");
    expect(JSON.stringify(body)).not.toContain("project.supabase.test");
    expect(mocks.logServerError).not.toHaveBeenCalled();
  });

  it("returns 503 with a safe payload when PostgREST fails", async () => {
    mocks.createAdminClient.mockReturnValue(client({ database: Promise.resolve({ error: new Error("db failure") }) }));

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(body).toMatchObject({ ok: false, database: "unreachable", auth: "reachable", storage: "reachable" });
    expect(JSON.stringify(body)).not.toContain("db failure");
    expect(mocks.logServerError).toHaveBeenCalledWith(
      "health.check_failed",
      expect.any(Error),
      expect.objectContaining({ metadata: { healthDependency: "database" } }),
    );
  });

  it("returns 503 when the PostgREST request times out", async () => {
    vi.useFakeTimers();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      return controller.signal;
    });
    const retry = vi.fn();
    const abortSignal = vi.fn((signal: AbortSignal) => {
      retry.mockReturnValue(
        new Promise((resolve) => signal.addEventListener("abort", () => resolve({ error: new Error("aborted") }))),
      );
      return { retry };
    });
    const slowClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ abortSignal }) }),
      }),
      storage: { getBucket: vi.fn().mockResolvedValue({ error: null }) },
    };
    mocks.createAdminClient.mockReturnValue(slowClient);

    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(timeout).toHaveBeenCalledWith(HEALTH_TIMEOUT_MS);
  });

  it("returns 503 when Auth returns a non-2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, database: "reachable", auth: "unreachable", storage: "reachable" });
  });

  it("returns 503 when Auth has a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const response = await GET(request());
    expect(response.status).toBe(503);
  });

  it("returns 503 when Auth times out", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      return controller.signal;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((_: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
      ),
    );

    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS);
    const response = await pending;

    expect(response.status).toBe(503);
  });

  it("returns 503 when Storage is unavailable", async () => {
    mocks.createAdminClient.mockReturnValue(client({ storage: Promise.resolve({ error: new Error("bucket denied") }) }));

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, database: "reachable", auth: "reachable", storage: "unreachable" });
  });

  it("returns 503 when Storage does not resolve within the timeout", async () => {
    vi.useFakeTimers();
    mocks.createAdminClient.mockReturnValue(client({ storage: new Promise(() => undefined) }));

    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS);
    const response = await pending;

    expect(response.status).toBe(503);
  });

  it("returns 503 when required configuration is unavailable", async () => {
    mocks.getPublicSupabaseConfig.mockImplementation(() => {
      throw new Error("missing configuration");
    });

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      database: "unreachable",
      auth: "unreachable",
      storage: "unreachable",
    });
    expect(mocks.logServerError).toHaveBeenCalledWith(
      "health.check_failed",
      expect.any(Error),
      expect.objectContaining({ metadata: { healthDependency: "configuration" } }),
    );
  });

  it("uses the existing request ID context when logging a failure", async () => {
    mocks.createAdminClient.mockReturnValue(client({ database: Promise.resolve({ error: new Error("db failure") }) }));

    await GET(request("request-123"));

    expect(mocks.logServerError).toHaveBeenCalledWith(
      "health.check_failed",
      expect.any(Error),
      expect.objectContaining({ requestId: "request-123", route: "/api/health" }),
    );
  });
});
