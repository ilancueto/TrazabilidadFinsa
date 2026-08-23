import { describe, expect, it } from "vitest";
import { aggregateTechnicalMetrics, aggregateTechnicalMetricsNdjson } from "@/lib/technical-metrics";

const window = { start: "2026-08-01T00:00:00.000Z", end: "2026-08-02T00:00:00.000Z" };
const timestamp = "2026-08-01T12:00:00.000Z";
const completeSources = { logs: "AVAILABLE", auditEvents: "AVAILABLE" } as const;

function apiSample(durationMs: number, operation = "evidence.upload") {
  return {
    timestamp,
    code: "technical.api_request_completed",
    operation,
    durationMs,
    statusCode: 200,
    result: "success",
  };
}

describe("technical metrics aggregation", () => {
  it("uses percentile_cont interpolation only when at least 20 valid samples exist", () => {
    const records = Array.from({ length: 20 }, (_, index) => apiSample(index));
    const report = aggregateTechnicalMetrics(records, window, completeSources);

    expect(report.apiLatency["evidence.upload"]).toEqual({
      n: 20,
      status: "AVAILABLE",
      p50: 9.5,
      p95: 18.05,
    });
  });

  it("keeps empty and insufficient populations distinct and omits numeric percentiles", () => {
    const report = aggregateTechnicalMetrics([apiSample(100), apiSample(200)], window, completeSources);

    expect(report.apiLatency["evidence.upload"]).toEqual({ n: 2, status: "INSUFFICIENT_SAMPLE" });
    expect(report.apiLatency["delivery.report"]).toEqual({ n: 0, status: "NO_DATA" });
  });

  it("filters invalid durations, unknown operations, malformed NDJSON, and records outside the UTC window", () => {
    const report = aggregateTechnicalMetricsNdjson([
      JSON.stringify(apiSample(10)),
      JSON.stringify({ ...apiSample(-1), timestamp }),
      JSON.stringify({ ...apiSample(Number.NaN), timestamp }),
      JSON.stringify({ ...apiSample(30, "unknown.operation"), timestamp }),
      JSON.stringify({ ...apiSample(40), timestamp: "2026-08-02T00:00:00.000Z" }),
      "not json",
    ].join("\n"), window, completeSources);

    expect(report.apiLatency["evidence.upload"]).toEqual({ n: 1, status: "INSUFFICIENT_SAMPLE" });
    expect(report.discardedRecords).toBe(5);
  });

  it("keeps audit success counts separate from failed HTTP attempts, retries, and overlapping error categories", () => {
    const report = aggregateTechnicalMetrics([
      { created_at: timestamp, action: "EVIDENCE_UPLOADED", metadata: {} },
      { created_at: timestamp, action: "CLOSED", metadata: { exceptional: true } },
      { created_at: timestamp, action: "REOPENED", metadata: {} },
      {
        timestamp,
        code: "technical.api_request_failed",
        operation: "evidence.upload",
        durationMs: 10,
        statusCode: 413,
        metadata: { category: "http", uploadAttempt: 2 },
      },
      {
        timestamp,
        code: "evidence.register_rpc_failed",
        operation: "evidence.upload",
        statusCode: 500,
        metadata: { category: "rpc" },
      },
      {
        timestamp,
        code: "evidence.upload_failed",
        operation: "evidence.upload",
        statusCode: 500,
        metadata: { category: "api" },
      },
    ], window, completeSources);

    expect(report.uploads).toEqual({ successful: 1, failedAttempts: 1, retryAttempts: 1 });
    expect(report.audit).toEqual({ exceptionalClosures: 1, reopenings: 1 });
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "http", statusCode: 413, count: 1 }),
      expect.objectContaining({ category: "rpc", code: "evidence.register_rpc_failed", count: 1 }),
      expect.objectContaining({ category: "api", code: "evidence.upload_failed", count: 1 }),
    ]));
  });

  it("defaults both sources to UNKNOWN and never presents absent exports as zero or NO_DATA", () => {
    const report = aggregateTechnicalMetrics([apiSample(50)], window);
    expect(report.uploads).toEqual({ successful: null, failedAttempts: null, retryAttempts: null });
    expect(report.audit).toEqual({ exceptionalClosures: null, reopenings: null });
    expect(report.errors).toBeNull();
    expect(report.apiLatency["evidence.upload"]).toEqual({ status: "UNKNOWN" });
  });

  it("keeps logs and audit availability independent", () => {
    const records = [
      apiSample(50),
      { timestamp, code: "technical.api_request_failed", operation: "evidence.upload", durationMs: 5, statusCode: 500, metadata: { category: "http" } },
      { created_at: timestamp, action: "EVIDENCE_UPLOADED", metadata: {} },
      { created_at: timestamp, action: "CLOSED", metadata: { exceptional: true } },
      { created_at: timestamp, action: "REOPENED", metadata: {} },
    ];

    const logsUnknown = aggregateTechnicalMetrics(records, window, { logs: "UNKNOWN", auditEvents: "AVAILABLE" });
    expect(logsUnknown.uploads).toEqual({ successful: 1, failedAttempts: null, retryAttempts: null });
    expect(logsUnknown.audit).toEqual({ exceptionalClosures: 1, reopenings: 1 });
    expect(logsUnknown.errors).toBeNull();
    expect(logsUnknown.apiLatency["evidence.upload"]).toEqual({ status: "UNKNOWN" });

    const auditUnknown = aggregateTechnicalMetrics(records, window, { logs: "AVAILABLE", auditEvents: "UNKNOWN" });
    expect(auditUnknown.uploads).toEqual({ successful: null, failedAttempts: 1, retryAttempts: 0 });
    expect(auditUnknown.audit).toEqual({ exceptionalClosures: null, reopenings: null });
    expect(auditUnknown.errors).toEqual([{
      category: "http", operation: "evidence.upload", code: "technical.api_request_failed", statusCode: 500, count: 1,
    }]);
    expect(auditUnknown.apiLatency["evidence.upload"]).toEqual({ n: 2, status: "INSUFFICIENT_SAMPLE" });
  });

  it("ignores undeclared error dimensions and retry-like metadata outside terminal upload events", () => {
    const report = aggregateTechnicalMetrics([
      {
        timestamp,
        code: "arbitrary.code.from.another_feature",
        operation: "user-controlled-operation",
        metadata: { category: "api", uploadAttempt: 99 },
      },
      {
        timestamp,
        code: "evidence.upload_failed",
        operation: "evidence.upload",
        metadata: { category: "api", uploadAttempt: 2 },
      },
    ], window, completeSources);

    expect(report.errors).toEqual([
      { category: "api", operation: "evidence.upload", code: "evidence.upload_failed", count: 1 },
    ]);
    expect(report.uploads.retryAttempts).toBe(0);
  });
});
