import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function setFullyConfiguredStagingEnvironment() {
  process.env.ERROR_TRACKING_ENABLED = "true";
  process.env.SENTRY_DSN = "https://server@example.invalid/1";
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.invalid/1";
  process.env.SENTRY_AUTH_TOKEN = "placeholder-token";
  process.env.SENTRY_ORG = "placeholder-org";
  process.env.SENTRY_PROJECT = "placeholder-project";
  process.env.SENTRY_RELEASE = "a3d78778de21ca758209d41e44d6b03a35b58143";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = "staging";
  delete process.env.CI;
}

describe("Next configuration without Sentry build wrapper", () => {
  afterEach(() => {
    vi.resetModules();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("never enables source-map upload or client tracing metadata, even with future placeholders", async () => {
    setFullyConfiguredStagingEnvironment();
    const config = (await import("../next.config")).default;
    const source = readFileSync("next.config.ts", "utf8");

    expect(config.experimental?.clientTraceMetadata).toBeUndefined();
    expect(config.webpack).toBeUndefined();
    expect(source).not.toContain("withSentryConfig");
    expect(source).not.toContain("@sentry/nextjs");
    expect(source).not.toContain("sourcemaps");
  });
});
