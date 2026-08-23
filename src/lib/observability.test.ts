import { afterEach, describe, expect, it, vi } from "vitest";

const { captureServerException } = vi.hoisted(() => ({ captureServerException: vi.fn() }));

vi.mock("@/lib/error-tracking/server", () => ({ captureServerException }));

import {
  buildServerLog,
  getRequestLogContext,
  logServerError,
  logServerEvent,
  TECHNICAL_API_OPERATIONS,
  withTechnicalApiMetric,
} from "@/lib/observability";

describe("server observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a structured success log with correlation and duration", () => {
    const entry = buildServerLog({
      level: "info",
      code: "evidence.upload_completed",
      message: "Evidence upload completed",
      requestId: "request-123",
      operationId: "operation-123",
      route: "/api/evidence",
      action: "uploadEvidence",
      operation: "evidence.upload",
      actorId: "user-123",
      deliveryId: "delivery-123",
      durationMs: 12.6,
      result: "success",
      metadata: { mimeType: "image/jpeg", sizeBytes: 1234 },
    });

    expect(entry).toMatchObject({
      level: "info",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      code: "evidence.upload_completed",
      requestId: "request-123",
      operationId: "operation-123",
      route: "/api/evidence",
      action: "uploadEvidence",
      operation: "evidence.upload",
      actorId: "user-123",
      deliveryId: "delivery-123",
      durationMs: 13,
      result: "success",
      metadata: { mimeType: "image/jpeg", sizeBytes: 1234 },
    });
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it("reuses a safe request ID and replaces unsafe input", () => {
    expect(getRequestLogContext(new Request("https://cat.local/api/evidence", {
      headers: { "x-request-id": "incoming-123" },
    }))).toEqual({ requestId: "incoming-123", route: "/api/evidence" });

    const unsafe = getRequestLogContext(new Request("https://cat.local/api/evidence", {
      headers: { "x-request-id": "<script>alert(1)</script>" },
    }));
    expect(unsafe.route).toBe("/api/evidence");
    expect(unsafe.requestId).toMatch(/^req_/);
    expect(unsafe.requestId).not.toContain("script");
  });

  it("redacts nested secrets and omits binary or unserializable metadata", () => {
    const entry = buildServerLog({
      level: "warn",
      code: "test.redaction",
      message: "Safe warning",
      metadata: {
        password: "not-for-logs",
        nested: {
          accessToken: "access-token-not-for-logs",
          authorization: "Bearer bearer-token-not-for-logs",
          safe: "kept",
        },
        image: new Uint8Array([1, 2, 3]),
        bigint: BigInt(10),
        custom: new (class CustomValue {})(),
      },
    });
    const serialized = JSON.stringify(entry);

    expect(entry.metadata).toMatchObject({
      password: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", authorization: "[REDACTED]", safe: "kept" },
      image: "[REDACTED]",
      bigint: "[UNSERIALIZABLE]",
      custom: "[UNSERIALIZABLE]",
    });
    expect(serialized).not.toContain("not-for-logs");
    expect(serialized).not.toContain("bearer-token");
  });

  it("keeps controlled detail for known errors and protects error messages", () => {
    const error = Object.assign(
      new Error("database rejected password=not-for-logs and Bearer bearer-token-not-for-logs"),
      { code: "DB_FAILURE" },
    );
    const entry = buildServerLog({
      level: "error",
      code: "database.query_failed",
      message: "Database query failed",
      result: "failure",
      error,
    });
    const serialized = JSON.stringify(entry);

    expect(entry.error).toEqual({
      name: "Error",
      message: "database rejected password=[REDACTED] and Bearer [REDACTED]",
      code: "DB_FAILURE",
    });
    expect(serialized).not.toContain("not-for-logs");
    expect(serialized).not.toContain("stack");
  });

  it("does not serialize unknown errors and emits JSON only", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const entry = logServerEvent({
      level: "error",
      code: "unexpected.failure",
      message: "Operation failed",
      result: "failure",
      error: { refreshToken: "not-for-logs", nested: { password: "not-for-logs" } },
    });

    expect(entry.error).toEqual({ name: "UnknownError", message: "Unexpected non-error value" });
    expect(consoleError).toHaveBeenCalledOnce();
    const output = consoleError.mock.calls[0]?.[0];
    expect(typeof output).toBe("string");
    expect(JSON.parse(output as string)).toEqual(entry);
    expect(output).not.toContain("not-for-logs");
  });

  it("emits the local JSON entry before the best-effort external bridge", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    captureServerException.mockImplementation(() => {
      expect(consoleError).toHaveBeenCalledOnce();
    });

    const entry = logServerError("evidence.upload_failed", new Error("database unavailable"), {
      requestId: "request-123",
      route: "/api/evidence",
      operation: "evidence.upload",
    });

    expect(entry.error?.message).toBe("database unavailable");
    expect(captureServerException).toHaveBeenCalledWith(expect.any(Error), {
      code: "evidence.upload_failed",
      route: "/api/evidence",
      action: undefined,
      operation: "evidence.upload",
      requestId: "request-123",
      operationId: undefined,
    });
  });

  it("records one normalized terminal API sample with a valid status code", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await withTechnicalApiMetric(
      new Request("https://cat.local/api/evidence/unsafe-id/file?token=never-a-dimension"),
      TECHNICAL_API_OPERATIONS.evidenceFile,
      async () => new Response(null, { status: 404 }),
      { metadata: { uploadAttempt: 2 } },
    );

    expect(response.status).toBe(404);
    expect(consoleWarn).toHaveBeenCalledOnce();
    expect(JSON.parse(consoleWarn.mock.calls[0]?.[0] as string)).toMatchObject({
      code: "technical.api_request_failed",
      route: "/api/evidence/[id]/file",
      operation: "evidence.file",
      statusCode: 404,
      result: "failure",
      metadata: { category: "http", uploadAttempt: 2 },
    });
  });

  it("does not let a technical log sink failure alter an API response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("log sink unavailable");
    });

    const response = await withTechnicalApiMetric(
      new Request("https://cat.local/api/evidence/unsafe-id/file"),
      TECHNICAL_API_OPERATIONS.evidenceFile,
      async () => new Response(null, { status: 404 }),
    );

    expect(response.status).toBe(404);
  });
});
