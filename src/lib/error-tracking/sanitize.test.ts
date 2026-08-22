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
        requestId: "request-123",
        actorId: "do-not-send",
        authorization: "Bearer do-not-send",
      },
      exception: {
        values: [{
          type: "UploadError",
          value: "person@example.invalid password=do-not-send Bearer do-not-send https://storage.invalid/evidence.jpg?sig=do-not-send#fragment https://s3.invalid/evidence.jpg?X-Amz-Signature=do-not-send",
          stacktrace: {
            frames: [{
              filename: "https://cat.invalid/api/upload?token=do-not-send#fragment",
              abs_path: "https://cat.invalid/api/upload?token=do-not-send#fragment",
              function: "upload",
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
      tags: { code: "evidence.upload_failed", requestId: "request-123" },
      exception: { values: [{ type: "UploadError" }] },
    });
    for (const forbidden of ["do-not-send", "person@example.invalid", "203.0.113.9", "?token=", "#fragment", "storage.invalid/evidence.jpg", "s3.invalid/evidence.jpg", "actorId", "authorization", "vars", "pre_context"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("drops an event without a known exception shape", () => {
    expect(sanitizeSentryEvent({ message: "unsafe" })).toBeNull();
  });
});
