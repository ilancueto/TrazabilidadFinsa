const STAGING_BRANCH = "staging";
const STAGING_ENVIRONMENT = "staging";
const SHA = /^[a-f0-9]{7,64}$/i;

type ErrorTrackingEnv = Record<string, string | undefined>;

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isStagingPreview(env: ErrorTrackingEnv = process.env): boolean {
  return env.CI !== "true" &&
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === STAGING_BRANCH;
}

export function isServerErrorTrackingEnabled(env: ErrorTrackingEnv = process.env): boolean {
  return env.ERROR_TRACKING_ENABLED === "true" &&
    hasValue(env.SENTRY_DSN) &&
    isStagingPreview(env);
}

export function isClientErrorTrackingBuildEnabled(env: ErrorTrackingEnv = process.env): boolean {
  return env.ERROR_TRACKING_ENABLED === "true" &&
    hasValue(env.NEXT_PUBLIC_SENTRY_DSN) &&
    isStagingPreview(env);
}

export function isClientErrorTrackingEnabled(env: ErrorTrackingEnv = process.env): boolean {
  return env.NEXT_PUBLIC_ERROR_TRACKING_ACTIVE === "true" && hasValue(env.NEXT_PUBLIC_SENTRY_DSN);
}

export const clientErrorTrackingEnabled = isClientErrorTrackingEnabled();

export function getSafeSentryRelease(env: ErrorTrackingEnv = process.env): string | undefined {
  const release = env.SENTRY_RELEASE ?? env.VERCEL_GIT_COMMIT_SHA;
  return release && SHA.test(release) ? release.toLowerCase() : undefined;
}

export function getServerErrorTrackingConfig(env: ErrorTrackingEnv = process.env) {
  if (!isServerErrorTrackingEnabled(env)) return undefined;

  return {
    dsn: env.SENTRY_DSN!.trim(),
    environment: STAGING_ENVIRONMENT,
    release: getSafeSentryRelease(env),
  };
}
