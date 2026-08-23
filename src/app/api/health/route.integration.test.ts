import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function requireLocalSupabase() {
  const host = new URL(url).hostname;
  expect(url).toBeTruthy();
  expect(anonKey).toBeTruthy();
  expect(serviceKey).toBeTruthy();
  expect(["127.0.0.1", "localhost"]).toContain(host);
}

describe("health integration", () => {
  it("checks local PostgREST, Auth and the evidences Storage bucket", async () => {
    requireLocalSupabase();

    const response = await GET(new Request("http://127.0.0.1/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(body).toMatchObject({
      ok: true,
      database: "reachable",
      auth: "reachable",
      storage: "reachable",
      service: "cat-trazabilidad",
    });
  });
});
