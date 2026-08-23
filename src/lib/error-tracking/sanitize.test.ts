import { createEventEnvelope, serializeEnvelope } from "@sentry/core";
import { describe, expect, it } from "vitest";
import { sanitizeSentryEvent } from "@/lib/error-tracking/sanitize";

describe("Sentry event sanitization", () => {
  it("rebuilds a hostile event from an allowlist", () => {
    const event = sanitizeSentryEvent({
      event_id: "a".repeat(32),
      environment: "staging",
      release: "a3d78778de21ca758209d41e44d6b03a35b58143",
      request: {
        cookies: "session=do-not-send",
        headers: { authorization: "Bearer do-not-send" },
        data: "password=do-not-send",
        url: "https://cat.invalid/api/upload?token=do-not-send",
      },
      user: { email: "person@example.invalid", ip_address: "203.0.113.9" },
      breadcrumbs: [{ message: "do-not-send" }],
      extra: { signedUrl: "https://storage.invalid/file?sig=do-not-send" },
      contexts: { device: { name: "do-not-send" } },
      tags: {
        code: "evidence.upload_failed",
        requestId: "req_123e4567-e89b-12d3-a456-426614174000",
        operation: "evidence.upload",
        method: "POST",
        runtime: "nodejs",
        route: "/deliveries/Juan-Perez/order-998877",
        action: "JuanPerez",
        actorId: "do-not-send",
        authorization: "Bearer do-not-send",
      },
      exception: {
        values: [{
          type: "JuanPerezError",
          value: "Juan Pérez, +54 11 5555-1234, CUIT 20-12345678-9, Av. Siempre Viva 742, pedido 998877, person@example.invalid password=do-not-send Bearer do-not-send https://storage.invalid/evidence.jpg?sig=do-not-send#fragment https://s3.invalid/evidence.jpg?X-Amz-Signature=do-not-send",
          stacktrace: {
            frames: [{
              filename: "https://cat.invalid/clientes/JuanPerez/pedido-998877.ts?token=do-not-send#fragment",
              abs_path: "/Users/JuanPerez/pedido-998877.ts",
              function: "procesarJuanPerezPedido998877",
              lineno: 42,
              colno: 7,
              in_app: true,
              vars: { password: "do-not-send" },
              pre_context: ["do-not-send"],
            }],
          },
        }],
      },
    });
    const serialized = JSON.stringify(event);

    expect(event).toMatchObject({
      level: "error",
      environment: "staging",
      tags: {
        code: "evidence.upload_failed",
        method: "POST",
        runtime: "nodejs",
      },
      exception: {
        values: [{
          type: "Error",
          value: "[REDACTED_ERROR_MESSAGE]",
          stacktrace: {
            frames: [{ filename: "[REDACTED_FRAME]", in_app: true }],
          },
        }],
      },
    });
    expect(event?.tags).not.toHaveProperty("route");
    expect(event?.tags).not.toHaveProperty("action");
    expect(event?.tags).not.toHaveProperty("operation");
    expect(event?.tags).not.toHaveProperty("requestId");
    expect(event).not.toHaveProperty("sdk");
    for (const forbidden of [
      "do-not-send",
      "Juan",
      "+54",
      "20-12345678-9",
      "Siempre Viva",
      "998877",
      "person@example.invalid",
      "203.0.113.9",
      "?token=",
      "#fragment",
      "storage.invalid/evidence.jpg",
      "s3.invalid/evidence.jpg",
      "actorId",
      "authorization",
      "vars",
      "pre_context",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("fails closed for arbitrary exception types and tag values", () => {
    const event = sanitizeSentryEvent({
      tags: {
        code: "Pedido 998877 de Juan Pérez",
        requestId: "customer-Juan-Perez",
        operationId: "op_abcdef12",
        digest: "998877",
        action: "juan_perez",
        operation: "pedido_998877",
        method: "POST /clientes/123",
        routeType: "route",
        runtime: "nodejs",
      },
      exception: {
        values: [{
          type: "JuanPerezError",
          value: "Pedido 998877 para Juan Pérez en Av. Siempre Viva 742",
          stacktrace: {
            frames: [{
              filename: "/Users/JuanPerez/pedido-998877.ts",
              function: "procesarJuanPerezPedido998877",
              lineno: 998877,
            }],
          },
        }],
      },
    });

    expect(event).toMatchObject({
      tags: {
        routeType: "route",
        runtime: "nodejs",
      },
      exception: {
        values: [{
          type: "Error",
          value: "[REDACTED_ERROR_MESSAGE]",
          stacktrace: { frames: [{ filename: "[REDACTED_FRAME]" }] },
        }],
      },
    });
    for (const tag of ["code", "requestId", "operationId", "digest", "action", "operation", "method"]) {
      expect(event?.tags).not.toHaveProperty(tag);
    }
    expect(JSON.stringify(event)).not.toMatch(/Juan|998877|20-12345678-9|Siempre Viva|customer/);
  });

  it("drops an event without a known exception shape", () => {
    expect(sanitizeSentryEvent({ message: "unsafe" })).toBeNull();
  });

  it("removes trace and SDK processing metadata before envelope serialization", () => {
    const traceId = "trace-id-must-not-leave-the-sanitizer";
    const event = sanitizeSentryEvent({
      exception: {
        values: [{ type: "Error", value: "safe error" }],
      },
      contexts: {
        trace: {
          trace_id: traceId,
          span_id: "span-id-must-not-leave-the-sanitizer",
        },
      },
      sdkProcessingMetadata: {
        dynamicSamplingContext: {
          trace_id: traceId,
          public_key: "must-not-leave-the-sanitizer",
        },
      },
    });

    expect(event).not.toBeNull();
    if (!event) {
      throw new Error("Expected the error event to be sanitized");
    }

    expect(event).not.toHaveProperty("contexts");
    expect(event).not.toHaveProperty("sdkProcessingMetadata");

    const envelope = createEventEnvelope(event);
    const serializedEnvelope = serializeEnvelope(envelope);

    expect(envelope[0]).not.toHaveProperty("trace");
    expect(serializedEnvelope).not.toContain(traceId);
    expect(serializedEnvelope).not.toContain("sdkProcessingMetadata");
  });
});
