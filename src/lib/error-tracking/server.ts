import { isServerErrorTrackingEnabled } from "@/lib/error-tracking/config";

type SafeServerErrorContext = {
  code?: string;
  route?: string;
  action?: string;
  operation?: string;
  requestId?: string;
  operationId?: string;
  digest?: string;
  method?: string;
  routeType?: string;
  runtime?: string;
};

function tagsFromContext(context: SafeServerErrorContext): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") tags[key] = value;
  }
  return tags;
}

/** Fire-and-forget by design: Sentry must never delay or change application work. */
export function captureServerException(error: unknown, context: SafeServerErrorContext = {}): void {
  if (!isServerErrorTrackingEnabled()) return;

  void import("@sentry/nextjs")
    .then((Sentry) => {
      try {
        return Promise.resolve(Sentry.captureException(error, { tags: tagsFromContext(context) })).catch(() => undefined);
      } catch {
        return undefined;
      }
    })
    .catch(() => undefined);
}
