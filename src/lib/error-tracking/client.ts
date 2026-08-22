import * as Sentry from "@sentry/nextjs";
import { clientErrorTrackingEnabled } from "@/lib/error-tracking/config";

const capturedErrors = new WeakSet<Error>();

export function captureClientException(error: Error & { digest?: string }): void {
  if (!clientErrorTrackingEnabled || error.digest || capturedErrors.has(error)) return;
  capturedErrors.add(error);

  try {
    void Promise.resolve(Sentry.captureException(error)).catch(() => undefined);
  } catch {
    // Error reporting is intentionally isolated from rendering and recovery.
  }
}
