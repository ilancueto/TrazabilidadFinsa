import * as Sentry from "@sentry/nextjs";
import { isClientErrorTrackingEnabled } from "@/lib/error-tracking/config";
import { sanitizeSentryEvent } from "@/lib/error-tracking/sanitize";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (isClientErrorTrackingEnabled() && dsn) {
  try {
    Sentry.init({
      dsn,
      environment: "staging",
      sendDefaultPii: false,
      sampleRate: 1,
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      profileSessionSampleRate: 0,
      profileLifecycle: "manual",
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enableMetrics: false,
      enableLogs: false,
      sendClientReports: false,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSendTransaction: () => null,
      beforeSend: sanitizeSentryEvent,
      defaultIntegrations: false,
      integrations: [],
    });
  } catch {
    // Client telemetry is optional and cannot interfere with hydration.
  }
}
