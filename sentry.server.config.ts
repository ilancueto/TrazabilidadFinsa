import * as Sentry from "@sentry/nextjs";
import { getServerErrorTrackingConfig, isServerErrorTrackingEnabled } from "@/lib/error-tracking/config";
import { sanitizeSentryEvent } from "@/lib/error-tracking/sanitize";

const config = getServerErrorTrackingConfig();

if (config && isServerErrorTrackingEnabled()) {
  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      ...(config.release ? { release: config.release } : {}),
      sendDefaultPii: false,
      sampleRate: 1,
      profilesSampleRate: 0,
      profileSessionSampleRate: 0,
      profileLifecycle: "manual",
      enableMetrics: false,
      enableLogs: false,
      sendClientReports: false,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSendTransaction: () => null,
      beforeSend: sanitizeSentryEvent,
      defaultIntegrations: false,
      integrations: [],
      includeLocalVariables: false,
      includeServerName: false,
      registerEsmLoaderHooks: false,
      skipOpenTelemetrySetup: true,
    });
  } catch {
    // Initialization is optional telemetry and must not affect the server.
  }
}
