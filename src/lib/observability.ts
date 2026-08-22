export type ServerLogLevel = "debug" | "info" | "warn" | "error";
export type ServerLogResult = "success" | "failure";

export type ServerLogContext = {
  requestId?: string;
  operationId?: string;
  route?: string;
  action?: string;
  operation?: string;
  actorId?: string;
  deliveryId?: string;
  durationMs?: number;
  result?: ServerLogResult;
  metadata?: Record<string, unknown>;
};

export type ServerLogEntry = {
  timestamp: string;
  level: ServerLogLevel;
  environment: string;
  code: string;
  message: string;
  requestId?: string;
  operationId?: string;
  route?: string;
  action?: string;
  operation?: string;
  actorId?: string;
  deliveryId?: string;
  durationMs?: number;
  result?: ServerLogResult;
  metadata?: Record<string, unknown>;
  error?: { name: string; message: string; code?: string };
};

export type ServerLogInput = ServerLogContext & {
  level: ServerLogLevel;
  code: string;
  message: string;
  error?: unknown;
};

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

function environment(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function redactText(value: string): string {
  const redacted = value
    .replace(BEARER_TOKEN, `$1${REDACTED}`)
    .replace(SECRET_IN_TEXT, `$1${REDACTED}`);
  return redacted.length > MAX_STRING_LENGTH ? `${redacted.slice(0, MAX_STRING_LENGTH)}…` : redacted;
}

function isBinary(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
    (typeof Blob !== "undefined" && value instanceof Blob);
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : UNSERIALIZABLE;
  if (typeof value === "undefined") return undefined;
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return UNSERIALIZABLE;
  }
  if (isBinary(value)) return OMITTED_BINARY;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? UNSERIALIZABLE : value.toISOString();
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_COLLECTION_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  }
  if (!value || typeof value !== "object" || !isPlainObject(value)) return UNSERIALIZABLE;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY.test(key) || OMITTED_CONTENT_KEY.test(key)
      ? REDACTED
      : sanitizeValue(item, depth + 1);
  }
  return sanitized;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  return sanitizeValue(metadata) as Record<string, unknown>;
}

function sanitizeError(error: unknown): ServerLogEntry["error"] {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: "Unexpected non-error value" };
  }

  const possibleCode = (error as Error & { code?: unknown }).code;
  return {
    name: redactText(error.name || "Error"),
    message: redactText(error.message || "Server operation failed"),
    ...(typeof possibleCode === "string" ? { code: redactText(possibleCode) } : {}),
  };
}

function safeCorrelationId(value: string | null): string | undefined {
  return value && SAFE_CORRELATION_ID.test(value) ? value : undefined;
}

function newId(prefix: string): string {
  const crypto = globalThis.crypto;
  if (!crypto) return `${prefix}_unavailable`;
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  const values = crypto.getRandomValues(new Uint32Array(4));
  return `${prefix}_${Array.from(values).map((value) => value.toString(16)).join("-")}`;
}

export function createOperationId(): string {
  return newId("op");
}

export function getRequestLogContext(request: Request): Pick<ServerLogContext, "requestId" | "route"> {
  let route: string | undefined;
  try {
    route = new URL(request.url).pathname;
  } catch {
    route = undefined;
  }
  return {
    requestId: safeCorrelationId(request.headers.get("x-request-id")) ?? newId("req"),
    ...(route ? { route } : {}),
  };
}

export function buildServerLog(input: ServerLogInput): ServerLogEntry {
  const metadata = sanitizeMetadata(input.metadata);
  return {
    timestamp: new Date().toISOString(),
    level: input.level,
    environment: environment(),
    code: redactText(input.code),
    message: redactText(input.message),
    ...(safeCorrelationId(input.requestId ?? null) ? { requestId: input.requestId } : {}),
    ...(safeCorrelationId(input.operationId ?? null) ? { operationId: input.operationId } : {}),
    ...(input.route ? { route: redactText(input.route) } : {}),
    ...(input.action ? { action: redactText(input.action) } : {}),
    ...(input.operation ? { operation: redactText(input.operation) } : {}),
    ...(input.actorId ? { actorId: redactText(input.actorId) } : {}),
    ...(input.deliveryId ? { deliveryId: redactText(input.deliveryId) } : {}),
    ...(typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? { durationMs: Math.max(0, Math.round(input.durationMs)) }
      : {}),
    ...(input.result ? { result: input.result } : {}),
    ...(metadata ? { metadata } : {}),
    ...(input.error ? { error: sanitizeError(input.error) } : {}),
  };
}

export function logServerEvent(input: ServerLogInput): ServerLogEntry {
  const entry = buildServerLog(input);
  const serialized = JSON.stringify(entry);
  if (input.level === "error") console.error(serialized);
  else if (input.level === "warn") console.warn(serialized);
  else console.info(serialized);
  return entry;
}

export function logServerError(code: string, error: unknown, context: ServerLogContext = {}): ServerLogEntry {
  return logServerEvent({
    level: "error",
    code,
    message: "Server operation failed",
    result: "failure",
    error,
    ...context,
  });
}
