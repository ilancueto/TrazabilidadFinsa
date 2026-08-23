import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { auditActionClauses, encodeAuditCursor, escapeIlikeLiteral, parseAuditCursor, resolveAuditFilters } from "@/lib/audit/queries";
import { AUDIT_FILTER_ACTIONS } from "@/lib/audit/presentation";

const uuid = "11111111-1111-4111-8111-111111111111";
describe("audit queries", () => {
  it("uses Argentina calendar dates, 50 default and caps to 100", () => {
    const value = resolveAuditFilters({}, new Date("2026-08-23T12:00:00Z"));
    expect(value).toMatchObject({ from: "2026-07-25T03:00:00.000Z", to: "2026-08-24T03:00:00.000Z", pageSize: 50 });
    expect(resolveAuditFilters({ pageSize: 999 }, new Date()).pageSize).toBe(100);
    expect(() => resolveAuditFilters({ from: "2025-01-01", to: "2026-01-02" })).toThrow(/366/);
  });
  it("validates composite cursor", () => {
    const cursor = encodeAuditCursor({ createdAt: "2026-08-01T03:00:00.000Z", id: uuid });
    expect(parseAuditCursor(cursor)).toEqual({ createdAt: "2026-08-01T03:00:00.000Z", id: uuid });
    expect(() => parseAuditCursor("not-a-cursor")).toThrow(/inválido/);
  });
  it("has one precise predicate for every public action", () => {
    expect(AUDIT_FILTER_ACTIONS).toHaveLength(17);
    for (const action of AUDIT_FILTER_ACTIONS) expect(auditActionClauses(action).length).toBeGreaterThan(0);
    expect(auditActionClauses("ARCHIVED")).toEqual([["action", "eq", "EDITED"], ["metadata->>kind", "eq", "ARCHIVED"]]);
    expect(auditActionClauses("EDITED")).not.toEqual(auditActionClauses("ARCHIVED"));
  });
  it("treats search text as literal and validates delivery UUID", () => {
    expect(escapeIlikeLiteral('x, ("\\%_*')).toBe('x\\, \\(\\"\\\\\\%\\_\\*');
    expect(() => resolveAuditFilters({ actorId: "bad" })).toThrow(/Usuario/);
    expect(resolveAuditFilters({ delivery: uuid }).delivery).toBe(uuid);
    expect(resolveAuditFilters({ delivery: "ENT-100" }).delivery).toBe("ENT-100");
  });
});
