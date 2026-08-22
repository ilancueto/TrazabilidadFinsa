import { describe, expect, it } from "vitest";
import {
  getSafeSentryRelease,
  isClientErrorTrackingBuildEnabled,
  isClientErrorTrackingEnabled,
  isServerErrorTrackingEnabled,
} from "@/lib/error-tracking/config";

const staging = {
  ERROR_TRACKING_ENABLED: "true",
  SENTRY_DSN: "https://server@example.invalid/1",
  NEXT_PUBLIC_SENTRY_DSN: "https://client@example.invalid/1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "staging",
  SENTRY_AUTH_TOKEN: "build-token",
  SENTRY_ORG: "org",
  SENTRY_PROJECT: "project",
  SENTRY_RELEASE: "a3d78778de21ca758209d41e44d6b03a35b58143",
};

describe("error tracking gates", () => {
  it("allows only the complete staging-preview server gate", () => {
    expect(isServerErrorTrackingEnabled(staging)).toBe(true);
    expect(isClientErrorTrackingBuildEnabled(staging)).toBe(true);
  });

  it.each([
    {},
    { ...staging, ERROR_TRACKING_ENABLED: "false" },
    { ...staging, ERROR_TRACKING_ENABLED: "TRUE" },
    { ...staging, ERROR_TRACKING_ENABLED: "1" },
    { ...staging, ERROR_TRACKING_ENABLED: "yes" },
    { ...staging, SENTRY_DSN: "" },
    { ...staging, CI: "true" },
    { ...staging, VERCEL_ENV: "development" },
    { ...staging, VERCEL_GIT_COMMIT_REF: "feature/preview" },
    { ...staging, VERCEL_ENV: "production" },
  ])("keeps unsafe server environments OFF: %o", (env) => {
    expect(isServerErrorTrackingEnabled(env)).toBe(false);
  });

  it.each([
    {},
    { ...staging, ERROR_TRACKING_ENABLED: "false" },
    { ...staging, NEXT_PUBLIC_SENTRY_DSN: "" },
    { ...staging, CI: "true" },
    { ...staging, VERCEL_ENV: "production" },
    { ...staging, VERCEL_GIT_COMMIT_REF: "feature/preview" },
  ])("keeps unsafe public-build environments OFF: %o", (env) => {
    expect(isClientErrorTrackingBuildEnabled(env)).toBe(false);
  });

  it("requires both public build gate and public DSN in the browser", () => {
    expect(isClientErrorTrackingEnabled({
      NEXT_PUBLIC_ERROR_TRACKING_ACTIVE: "true",
      NEXT_PUBLIC_SENTRY_DSN: "https://client@example.invalid/1",
    })).toBe(true);
    expect(isClientErrorTrackingEnabled({ NEXT_PUBLIC_ERROR_TRACKING_ACTIVE: "false", NEXT_PUBLIC_SENTRY_DSN: "x" })).toBe(false);
    expect(isClientErrorTrackingEnabled({ NEXT_PUBLIC_ERROR_TRACKING_ACTIVE: "true" })).toBe(false);
  });

  it("uses only a hexadecimal release SHA", () => {
    expect(getSafeSentryRelease(staging)).toBe(staging.SENTRY_RELEASE);
    expect(getSafeSentryRelease({ SENTRY_RELEASE: "release-with-email@example.invalid" })).toBeUndefined();
  });
});
