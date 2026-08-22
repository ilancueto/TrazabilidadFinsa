import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.STAGING_BASE_URL;
const projectRef = process.env.STAGING_SUPABASE_PROJECT_REF;
const allowedRefs = new Set(
  (process.env.ALLOWED_STAGING_PROJECT_REFS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

if (process.env.STAGING_SMOKE !== "1") {
  throw new Error("Staging smoke bloqueado: falta STAGING_SMOKE=1");
}
if (!baseURL || new URL(baseURL).protocol !== "https:") {
  throw new Error("Staging smoke bloqueado: STAGING_BASE_URL debe usar HTTPS");
}
if (!projectRef || !allowedRefs.has(projectRef)) {
  throw new Error(
    "Staging smoke bloqueado: STAGING_SUPABASE_PROJECT_REF no está en ALLOWED_STAGING_PROJECT_REFS",
  );
}
if (projectRef === "jbhbjazagiwyryujnenv") {
  throw new Error("Staging smoke bloqueado: el target corresponde a FINSA PROD");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /(?:despacho|customer-pickup)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "staging-chromium" }],
});
