import type { ErrorEvent, SdkInfo } from "@sentry/core";

const REDACTED = "[REDACTED]";
const OMITTED_BINARY = "[OMITTED_BINARY]";
const UNSERIALIZABLE = "[UNSERIALIZABLE]";
const MAX_STRING_LENGTH = 1_024;
const MAX_COLLECTION_LENGTH = 50;
const MAX_DEPTH = 5;
const GENERIC_ERROR_MESSAGE = "[REDACTED_ERROR_MESSAGE]";
const GENERIC_FRAME_NAME = "[REDACTED_FRAME]";
const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SENSITIVE_KEY = /(?:password|passphrase|token|authorization|cookie|secret|api[_-]?key|service[_-]?role|credential|signed[_-]?url)/i;
const OMITTED_CONTENT_KEY = /^(?:payload|request[_-]?body|body|evidence|photo|image|file|binary|bytes|buffer)$/i;
const SECRET_IN_TEXT = /((?:password|passphrase|access[_-]?token|refresh[_-]?token|token|authorization|cookie|api[_-]?key|secret|service[_-]?role|credential)\s*(?:=|:)\s*["']?)([^\s,;"'}\]]+)/gi;
const BEARER_TOKEN = /(bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;
const SIGNED_URL_PARAMETER = /^(?:x-amz-(?:algorithm|credential|date|expires|security-token|signature)|signature|sig|token|access_token|expires)$/i;
const SAFE_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);
const SAFE_ROUTE_TYPES = new Set(["action", "middleware", "proxy", "render", "route"]);
const SAFE_RUNTIMES = new Set(["edge", "nodejs"]);
const SAFE_ERROR_CODES = new Set([
  "clients.list_failed",
  "error_tracking.controlled_test",
  "evidence.storage_void_failed",
  "evidence.thumbnail_failed",
  "evidence.upload_failed",
  "export.evidence_download_failed",
  "export.report_generation_failed",
  "health.check_failed",
  "proxy.auth_failed",
  "report.image_download_failed",
  "storage.remove_failed",
  "storage.void_move_failed",
]);

type UnknownRecord = Record<string, unknown>;

const SERVER_SDK_INFO = {
  settings: { infer_ip: "never" },
} satisfies Pick<SdkInfo, "settings">;

export function redactText(value: string): string {
  const redacted = value
    .replace(BEARER_TOKEN, `$1${REDACTED}`)
    .replace(SECRET_IN_TEXT, `$1${REDACTED}`);
  return redacted.length > MAX_STRING_LENGTH ? `${redacted.slice(0, MAX_STRING_LENGTH)}…` : redacted;
}

export function redactErrorTrackingText(value: string): string {
  return redactText(value)
    .replace(URL_IN_TEXT, sanitizeUrlInText)
    .replace(EMAIL, REDACTED);
}

function sanitizeUrlInText(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (Array.from(url.searchParams.keys()).some((key) => SIGNED_URL_PARAMETER.test(key))) return REDACTED;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return REDACTED;
  }
}

export function isSafeCorrelationId(value: string | null | undefined): value is string {
  return typeof value === "string" && SAFE_CORRELATION_ID.test(value);
}

function isBinary(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
    (typeof Blob !== "undefined" && value instanceof Blob);
}

function isPlainObject(value: object): value is UnknownRecord {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : UNSERIALIZABLE;
  if (typeof value === "undefined") return undefined;
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") return UNSERIALIZABLE;
  if (isBinary(value)) return OMITTED_BINARY;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? UNSERIALIZABLE : value.toISOString();
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, MAX_COLLECTION_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  if (!value || typeof value !== "object" || !isPlainObject(value)) return UNSERIALIZABLE;

  const sanitized: UnknownRecord = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY.test(key) || OMITTED_CONTENT_KEY.test(key)
      ? REDACTED
      : sanitizeValue(item, depth + 1);
  }
  return sanitized;
}

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && isPlainObject(value) ? value : undefined;
}

function sanitizeFrame(value: unknown): UnknownRecord | undefined {
  const frame = record(value);
  if (!frame) return undefined;

  const sanitized: UnknownRecord = { filename: GENERIC_FRAME_NAME };
  if (typeof frame.in_app === "boolean") sanitized.in_app = frame.in_app;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeException(value: unknown): UnknownRecord | undefined {
  const exception = record(value);
  if (!exception) return undefined;

  const sanitized: UnknownRecord = {};
  sanitized.type = "Error";
  sanitized.value = GENERIC_ERROR_MESSAGE;

  const stacktrace = record(exception.stacktrace);
  const frames = Array.isArray(stacktrace?.frames)
    ? stacktrace.frames.map(sanitizeFrame).filter((frame): frame is UnknownRecord => Boolean(frame))
    : [];
  if (frames.length > 0) sanitized.stacktrace = { frames };

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeTags(value: unknown): Record<string, string> {
  const tags = record(value);
  const sanitized: Record<string, string> = {};
  if (!tags) return sanitized;

  for (const [key, tagValue] of Object.entries(tags)) {
    if (typeof tagValue !== "string") continue;

    if (key === "code" && SAFE_ERROR_CODES.has(tagValue)) {
      sanitized[key] = tagValue;
    } else if (key === "method" && SAFE_METHODS.has(tagValue)) {
      sanitized[key] = tagValue;
    } else if (key === "routeType" && SAFE_ROUTE_TYPES.has(tagValue)) {
      sanitized[key] = tagValue;
    } else if (key === "runtime" && SAFE_RUNTIMES.has(tagValue)) {
      sanitized[key] = tagValue;
    }
  }
  return sanitized;
}

/**
 * Rebuilds a Sentry error event from an explicit allowlist. Unknown shapes are
 * dropped rather than serialized, so SDK defaults cannot add request data.
 */
export function sanitizeSentryEvent(event: unknown): ErrorEvent | null {
  const source = record(event);
  const exception = record(source?.exception);
  const values = Array.isArray(exception?.values)
    ? exception.values.map(sanitizeException).filter((value): value is UnknownRecord => Boolean(value))
    : [];
  if (values.length === 0) return null;

  const sanitized: UnknownRecord = {
    level: "error",
    exception: { values },
    tags: sanitizeTags(source?.tags),
  };
  if (typeof source?.event_id === "string" && /^[a-f0-9]{32}$/i.test(source.event_id)) {
    sanitized.event_id = source.event_id;
  }
  sanitized.environment = "staging";
  if (typeof source?.release === "string" && /^[a-f0-9]{7,64}$/i.test(source.release)) sanitized.release = source.release.toLowerCase();
  return sanitized as unknown as ErrorEvent;
}

/**
 * Server events explicitly opt out of Relay IP inference. This is added after
 * the shared allowlist so browser events and unapproved fields stay unchanged.
 */
export function sanitizeServerSentryEvent(event: unknown): ErrorEvent | null {
  const sanitized = sanitizeSentryEvent(event);
  return sanitized ? { ...sanitized, sdk: SERVER_SDK_INFO } : null;
}
