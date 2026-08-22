import type { ErrorEvent } from "@sentry/core";

const REDACTED = "[REDACTED]";
const OMITTED_BINARY = "[OMITTED_BINARY]";
const UNSERIALIZABLE = "[UNSERIALIZABLE]";
const MAX_STRING_LENGTH = 1_024;
const MAX_COLLECTION_LENGTH = 50;
const MAX_DEPTH = 5;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SENSITIVE_KEY = /(?:password|passphrase|token|authorization|cookie|secret|api[_-]?key|service[_-]?role|credential|signed[_-]?url)/i;
const OMITTED_CONTENT_KEY = /^(?:payload|request[_-]?body|body|evidence|photo|image|file|binary|bytes|buffer)$/i;
const SECRET_IN_TEXT = /((?:password|passphrase|access[_-]?token|refresh[_-]?token|token|authorization|cookie|api[_-]?key|secret|service[_-]?role|credential)\s*(?:=|:)\s*["']?)([^\s,;"'}\]]+)/gi;
const BEARER_TOKEN = /(bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;
const SIGNED_URL_PARAMETER = /^(?:x-amz-(?:algorithm|credential|date|expires|security-token|signature)|signature|sig|token|access_token|expires)$/i;
const SAFE_TAGS = new Set(["code", "route", "action", "operation", "requestId", "operationId", "digest", "method", "routeType", "runtime"]);

type UnknownRecord = Record<string, unknown>;

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

function cleanStackPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value, "https://stack.invalid");
    if (url.origin === "https://stack.invalid") return redactErrorTrackingText(url.pathname);
    url.search = "";
    url.hash = "";
    return redactErrorTrackingText(url.toString());
  } catch {
    return redactErrorTrackingText(value.split(/[?#]/, 1)[0] ?? "");
  }
}

function sanitizeFrame(value: unknown): UnknownRecord | undefined {
  const frame = record(value);
  if (!frame) return undefined;

  const sanitized: UnknownRecord = {};
  const filename = cleanStackPath(frame.filename ?? frame.abs_path);
  if (filename) sanitized.filename = filename;
  if (typeof frame.function === "string") sanitized.function = redactErrorTrackingText(frame.function);
  if (typeof frame.lineno === "number" && Number.isFinite(frame.lineno)) sanitized.lineno = frame.lineno;
  if (typeof frame.colno === "number" && Number.isFinite(frame.colno)) sanitized.colno = frame.colno;
  if (typeof frame.in_app === "boolean") sanitized.in_app = frame.in_app;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeException(value: unknown): UnknownRecord | undefined {
  const exception = record(value);
  if (!exception) return undefined;

  const sanitized: UnknownRecord = {};
  if (typeof exception.type === "string") sanitized.type = redactErrorTrackingText(exception.type);
  if (typeof exception.value === "string") sanitized.value = redactErrorTrackingText(exception.value);

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
    if (SAFE_TAGS.has(key) && typeof tagValue === "string") sanitized[key] = redactErrorTrackingText(tagValue);
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
