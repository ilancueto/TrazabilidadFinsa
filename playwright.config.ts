import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const localEnv = readEnvFile(".env.local");

function readEnvFile(name: string): Record<string, string> {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function definedEnv(source: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

function assertLocalHost(value: string | undefined, label: string) {
  if (!value) return;
  const host = new URL(value).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`${label} must be local for E2E (got ${host})`);
  }
}

assertLocalHost(baseURL, "E2E_BASE_URL");
assertLocalHost(
  ci ? process.env.NEXT_PUBLIC_SUPABASE_URL : localEnv.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: ci ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: ci ? "npm run start" : "npm run dev:http",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !ci,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
        env: definedEnv({
          ...process.env,
          ...(ci ? {} : localEnv),
        }),
      },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile-smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-smoke",
      testMatch: /mobile-smoke\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
