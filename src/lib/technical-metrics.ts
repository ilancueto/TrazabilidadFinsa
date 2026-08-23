import { TECHNICAL_API_OPERATIONS, type TechnicalErrorCategory } from "@/lib/observability";

const MINIMUM_PERCENTILE_SAMPLE = 20;
const technicalOperations: Set<string> = new Set(
  Object.values(TECHNICAL_API_OPERATIONS).map(({ operation }) => operation),
);
const technicalHttpFailureCodes = new Set(["technical.api_request_failed"]);
const technicalApiErrorCodes = new Map<string, Set<string>>(
  [...technicalOperations].map((operation) => [operation, new Set(["technical.api_unhandled_error"])]),
);
technicalApiErrorCodes.set("evidence.upload", new Set([
  "technical.api_unhandled_error",
  "evidence.storage_upload_failed",
  "evidence.upload_failed",
]));
const technicalRpcErrorCodes = new Map<string, Set<string>>([
  ["evidence.upload", new Set(["evidence.register_rpc_failed"])],
  ["deliveries.bulk_close", new Set(["deliveries.bulk_close_rpc_failed"])],
  ["deliveries.reopen", new Set(["deliveries.reopen_rpc_failed"])],
]);

export type TechnicalMetricAvailability = "AVAILABLE" | "UNKNOWN";
export type TechnicalLatencyStatus = "NO_DATA" | "INSUFFICIENT_SAMPLE" | "AVAILABLE";

export type TechnicalMetricsWindow = {
  start: string | Date;
  end: string | Date;
};

export type TechnicalMetricSourceAvailability = {
  logs?: TechnicalMetricAvailability;
  auditEvents?: TechnicalMetricAvailability;
};

type MetricLog = {
  timestamp?: unknown;
  code?: unknown;
  operation?: unknown;
  durationMs?: unknown;
  statusCode?: unknown;
  result?: unknown;
  metadata?: unknown;
};

type AuditEvent = {
  created_at?: unknown;
  action?: unknown;
  metadata?: unknown;
};

export type TechnicalMetricsReport = {
  discardedRecords: number;
  uploads: {
    successful: number | null;
    failedAttempts: number | null;
    retryAttempts: number | null;
  };
  audit: {
    exceptionalClosures: number | null;
    reopenings: number | null;
  };
  apiLatency: Record<string, { n: number; status: TechnicalLatencyStatus; p50?: number; p95?: number }>;
  errors: Array<{
    category: TechnicalErrorCategory;
    operation: string;
    code: string;
    statusCode?: number;
    count: number;
  }>;
};

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function inWindow(value: unknown, start: Date, end: Date): boolean {
  const timestamp = validDate(value);
  return timestamp !== null && timestamp >= start && timestamp < end;
}

function metricMetadata(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function percentileCont(sorted: number[], percentile: number): number {
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function sourceCount(count: number, availability: TechnicalMetricAvailability): number | null {
  return availability === "AVAILABLE" ? count : null;
}

function isKnownTechnicalError(category: unknown, operation: string | undefined, code: string): category is TechnicalErrorCategory {
  if (!operation) return false;
  if (category === "http") return technicalOperations.has(operation) && technicalHttpFailureCodes.has(code);
  if (category === "api") return technicalApiErrorCodes.get(operation)?.has(code) ?? false;
  if (category === "rpc") return technicalRpcErrorCodes.get(operation)?.has(code) ?? false;
  return false;
}

export function parseTechnicalMetricNdjson(ndjson: string): { records: unknown[]; discardedRecords: number } {
  const records: unknown[] = [];
  let discardedRecords = 0;
  for (const line of ndjson.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      discardedRecords++;
    }
  }
  return { records, discardedRecords };
}

export function aggregateTechnicalMetrics(
  records: Iterable<unknown>,
  window: TechnicalMetricsWindow,
  availability: TechnicalMetricSourceAvailability = {},
): TechnicalMetricsReport {
  const start = validDate(window.start);
  const end = validDate(window.end);
  if (!start || !end || start >= end) throw new Error("Technical metric window must be a valid UTC interval [start, end)");

  const logsAvailability = availability.logs ?? "AVAILABLE";
  const auditAvailability = availability.auditEvents ?? "AVAILABLE";
  const durations = new Map<string, number[]>();
  const errors = new Map<string, TechnicalMetricsReport["errors"][number]>();
  let uploadFailures = 0;
  let retryAttempts = 0;
  let successfulUploads = 0;
  let exceptionalClosures = 0;
  let reopenings = 0;
  let discardedRecords = 0;

  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      discardedRecords++;
      continue;
    }
    const candidate = record as MetricLog & AuditEvent;
    const metadata = metricMetadata(candidate.metadata);

    if (typeof candidate.action === "string" && inWindow(candidate.created_at, start, end)) {
      if (candidate.action === "EVIDENCE_UPLOADED") successfulUploads++;
      if (candidate.action === "CLOSED" && metadata.exceptional === true) exceptionalClosures++;
      if (candidate.action === "REOPENED") reopenings++;
      continue;
    }

    if (typeof candidate.code !== "string" || !inWindow(candidate.timestamp, start, end)) {
      discardedRecords++;
      continue;
    }

    const operation = typeof candidate.operation === "string" ? candidate.operation : undefined;
    const statusCode = typeof candidate.statusCode === "number" && Number.isInteger(candidate.statusCode)
      ? candidate.statusCode
      : undefined;
    const category = metadata.category;

    const isTerminalApiRecord = candidate.code === "technical.api_request_completed" || candidate.code === "technical.api_request_failed";
    if (isTerminalApiRecord) {
      const duration = candidate.durationMs;
      if (operation && technicalOperations.has(operation) && typeof duration === "number" && Number.isFinite(duration) && duration >= 0) {
        const values = durations.get(operation) ?? [];
        values.push(duration);
        durations.set(operation, values);
      } else {
        discardedRecords++;
      }
      if (candidate.code === "technical.api_request_failed" && operation === "evidence.upload") uploadFailures++;
    }

    if (isTerminalApiRecord && operation === "evidence.upload" && typeof metadata.uploadAttempt === "number" && metadata.uploadAttempt > 1) {
      retryAttempts++;
    }

    if (isKnownTechnicalError(category, operation, candidate.code) && operation) {
      const key = `${category}\u0000${operation}\u0000${candidate.code}\u0000${statusCode ?? ""}`;
      const existing = errors.get(key);
      if (existing) existing.count++;
      else errors.set(key, { category, operation, code: candidate.code, ...(statusCode ? { statusCode } : {}), count: 1 });
    }
  }

  const apiLatency: TechnicalMetricsReport["apiLatency"] = {};
  for (const operation of technicalOperations) {
    const values = (durations.get(operation) ?? []).sort((a, b) => a - b);
    if (values.length === 0) apiLatency[operation] = { n: 0, status: "NO_DATA" };
    else if (values.length < MINIMUM_PERCENTILE_SAMPLE) apiLatency[operation] = { n: values.length, status: "INSUFFICIENT_SAMPLE" };
    else apiLatency[operation] = {
      n: values.length,
      status: "AVAILABLE",
      p50: percentileCont(values, 0.5),
      p95: percentileCont(values, 0.95),
    };
  }

  return {
    discardedRecords,
    uploads: {
      successful: sourceCount(successfulUploads, auditAvailability),
      failedAttempts: sourceCount(uploadFailures, logsAvailability),
      retryAttempts: sourceCount(retryAttempts, logsAvailability),
    },
    audit: {
      exceptionalClosures: sourceCount(exceptionalClosures, auditAvailability),
      reopenings: sourceCount(reopenings, auditAvailability),
    },
    apiLatency,
    errors: [...errors.values()].sort((a, b) =>
      `${a.category}:${a.operation}:${a.code}:${a.statusCode ?? ""}`.localeCompare(`${b.category}:${b.operation}:${b.code}:${b.statusCode ?? ""}`),
    ),
  };
}

export function aggregateTechnicalMetricsNdjson(
  ndjson: string,
  window: TechnicalMetricsWindow,
  availability: TechnicalMetricSourceAvailability = {},
): TechnicalMetricsReport {
  const parsed = parseTechnicalMetricNdjson(ndjson);
  const report = aggregateTechnicalMetrics(parsed.records, window, availability);
  return { ...report, discardedRecords: report.discardedRecords + parsed.discardedRecords };
}
