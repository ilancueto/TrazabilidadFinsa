import { captureServerException } from "@/lib/error-tracking/server";
import { isSafeCorrelationId, redactText, sanitizeValue } from "@/lib/error-tracking/sanitize";

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
  statusCode?: number;
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
  statusCode?: number;
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

function environment(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
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
  const incomingRequestId = request.headers.get("x-request-id");
  return {
    requestId: isSafeCorrelationId(incomingRequestId) ? incomingRequestId : newId("req"),
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
    ...(isSafeCorrelationId(input.requestId) ? { requestId: input.requestId } : {}),
    ...(isSafeCorrelationId(input.operationId) ? { operationId: input.operationId } : {}),
    ...(input.route ? { route: redactText(input.route) } : {}),
    ...(input.action ? { action: redactText(input.action) } : {}),
    ...(input.operation ? { operation: redactText(input.operation) } : {}),
    ...(input.actorId ? { actorId: redactText(input.actorId) } : {}),
    ...(input.deliveryId ? { deliveryId: redactText(input.deliveryId) } : {}),
    ...(typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? { durationMs: Math.max(0, Math.round(input.durationMs)) }
      : {}),
    ...(typeof input.statusCode === "number" && Number.isInteger(input.statusCode) && input.statusCode >= 100 && input.statusCode <= 599
      ? { statusCode: input.statusCode }
      : {}),
    ...(input.result ? { result: input.result } : {}),
    ...(metadata ? { metadata } : {}),
    ...(input.error ? { error: sanitizeError(input.error) } : {}),
  };
}

export const TECHNICAL_API_OPERATIONS = {
  evidenceUpload: { operation: "evidence.upload", route: "/api/evidence" },
  evidenceFile: { operation: "evidence.file", route: "/api/evidence/[id]/file" },
  deliveryNumberCheck: { operation: "deliveries.check_number", route: "/api/deliveries/check-number" },
  deliveriesExportZip: { operation: "deliveries.export_zip", route: "/api/deliveries/export-zip" },
  deliveryReport: { operation: "delivery.report", route: "/admin/deliveries/[id]/report" },
  diaExport: { operation: "deliveries.dia_export", route: "/admin/dia/export" },
} as const;

export type TechnicalApiOperation = (typeof TECHNICAL_API_OPERATIONS)[keyof typeof TECHNICAL_API_OPERATIONS];
export type TechnicalErrorCategory = "api" | "rpc" | "http";

export async function withTechnicalApiMetric<T extends Response>(
  request: Request,
  metric: TechnicalApiOperation,
  handler: () => Promise<T>,
  context: ServerLogContext = {},
): Promise<T> {
  const startedAt = performance.now();
  const requestContext = { ...getRequestLogContext(request), ...context };

  try {
    const response = await handler();
    logTechnicalApiResponse(metric, requestContext, performance.now() - startedAt, response.status);
    return response;
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    logTechnicalError("api", "technical.api_unhandled_error", error, {
      ...requestContext,
      ...metric,
      durationMs,
      statusCode: 500,
    });
    logTechnicalApiResponse(metric, requestContext, durationMs, 500);
    throw error;
  }
}

export function logTechnicalApiResponse(
  metric: TechnicalApiOperation,
  context: ServerLogContext,
  durationMs: number,
  statusCode: number,
): ServerLogEntry | undefined {
  const failed = statusCode >= 400;
  try {
    return logServerEvent({
      level: failed ? "warn" : "info",
      code: failed ? "technical.api_request_failed" : "technical.api_request_completed",
      message: failed ? "Technical API request failed" : "Technical API request completed",
      ...context,
      ...metric,
      durationMs,
      statusCode,
      result: failed ? "failure" : "success",
      ...(failed ? { metadata: { ...context.metadata, category: "http" satisfies TechnicalErrorCategory } } : {}),
    });
  } catch {
    return undefined;
  }
}

export function logTechnicalError(
  category: TechnicalErrorCategory,
  code: string,
  error: unknown,
  context: ServerLogContext,
): ServerLogEntry | undefined {
  try {
    return logServerError(code, error, {
      ...context,
      metadata: { ...context.metadata, category },
    });
  } catch {
    return undefined;
  }
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
  const entry = logServerEvent({
    level: "error",
    code,
    message: "Server operation failed",
    result: "failure",
    error,
    ...context,
  });
  captureServerException(error, {
    code: entry.code,
    route: entry.route,
    action: entry.action,
    operation: entry.operation,
    requestId: entry.requestId,
    operationId: entry.operationId,
  });
  return entry;
}
