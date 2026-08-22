import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildServerLog,
  getRequestLogContext,
  logServerEvent,
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
});
