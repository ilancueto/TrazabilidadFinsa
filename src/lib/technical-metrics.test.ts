import { describe, expect, it } from "vitest";
import { aggregateTechnicalMetrics, aggregateTechnicalMetricsNdjson } from "@/lib/technical-metrics";

const window = { start: "2026-08-01T00:00:00.000Z", end: "2026-08-02T00:00:00.000Z" };
const timestamp = "2026-08-01T12:00:00.000Z";

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
    const report = aggregateTechnicalMetrics(records, window);

    expect(report.apiLatency["evidence.upload"]).toEqual({
      n: 20,
      status: "AVAILABLE",
      p50: 9.5,
      p95: 18.05,
    });
  });

  it("keeps empty and insufficient populations distinct and omits numeric percentiles", () => {
    const report = aggregateTechnicalMetrics([apiSample(100), apiSample(200)], window);

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
    ].join("\n"), window);

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
    ], window);

    expect(report.uploads).toEqual({ successful: 1, failedAttempts: 1, retryAttempts: 1 });
    expect(report.audit).toEqual({ exceptionalClosures: 1, reopenings: 1 });
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "http", statusCode: 413, count: 1 }),
      expect.objectContaining({ category: "rpc", code: "evidence.register_rpc_failed", count: 1 }),
      expect.objectContaining({ category: "api", code: "evidence.upload_failed", count: 1 }),
    ]));
  });

  it("returns UNKNOWN counts when an exported source is incomplete instead of treating it as zero", () => {
    const report = aggregateTechnicalMetrics([], window, { logs: "UNKNOWN", auditEvents: "UNKNOWN" });
    expect(report.uploads).toEqual({ successful: null, failedAttempts: null, retryAttempts: null });
    expect(report.audit).toEqual({ exceptionalClosures: null, reopenings: null });
  });
});
