import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

const { createServerClient, getUser } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/observability", () => ({
  getRequestLogContext: vi.fn(() => ({})),
  logServerError: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-placeholder");
  getUser.mockResolvedValue({ data: { user: null } });
  createServerClient.mockReturnValue({ auth: { getUser } });
});

afterEach(() => vi.unstubAllEnvs());

async function request(path: string, mode?: string) {
  vi.stubEnv("NEXT_PUBLIC_MAINTENANCE_MODE", mode);
  const { proxy } = await import("./proxy");
  return proxy(new NextRequest(`https://example.test${path}`));
}

describe("maintenance proxy", () => {
  it.each(["/", "/login", "/admin?next=/picking", "/picking", "/api/health"])(
    "redirects %s by default without starting a session",
    async (path) => {
      const response = await request(path);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://example.test/mantenimiento");
      expect(response.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
      expect(createServerClient).not.toHaveBeenCalled();
    },
  );

  it("allows the maintenance page without a session or redirect loop", async () => {
    const response = await request("/mantenimiento", "true");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("redirects the maintenance page home when disabled", async () => {
    const response = await request("/mantenimiento?next=/admin", "false");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("restores protected-route session checks when disabled", async () => {
    const response = await request("/admin", "false");
    expect(response.headers.get("location")).toBe("https://example.test/login?next=%2Fadmin");
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("preserves the authenticated login redirect when disabled", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "test-user" } } });
    const response = await request("/login", "false");
    expect(response.headers.get("location")).toBe("https://example.test/");
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("preserves API bypass when disabled", async () => {
    const response = await request("/api/health", "false");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("matches app and API routes while excluding artwork and framework assets", async () => {
    const { config } = await import("./proxy");
    for (const url of ["/admin", "/mantenimiento", "/api/health", "/apiary", "/icons-admin", "/favicon.ico-preview"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
    for (const url of ["/maintenance-desktop.jpg", "/maintenance-mobile.jpg", "/_next/static/app.js", "/_next/image?url=test", "/icons/icon-192.png"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  });
});
