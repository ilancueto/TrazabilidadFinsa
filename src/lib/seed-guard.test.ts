import { describe, expect, it } from "vitest";
import {
  assertAllowedSeedTarget,
  FINSA_PRODUCTION_PROJECT_REF,
} from "../../scripts/seed-guard";

describe("assertAllowedSeedTarget", () => {
  it.each(["http://127.0.0.1:55321", "http://localhost:54321"])(
    "permite Supabase local (%s)",
    (supabaseUrl) => {
      expect(assertAllowedSeedTarget({ supabaseUrl })).toEqual({
        environment: "local",
        projectRef: null,
      });
    },
  );

  it("permite únicamente un project ref remoto allowlisted", () => {
    expect(
      assertAllowedSeedTarget({
        supabaseUrl: "https://stagingref.supabase.co",
        allowedProjectRefs: "stagingref",
      }),
    ).toEqual({ environment: "staging", projectRef: "stagingref" });
  });

  it("bloquea un proyecto remoto no allowlisted", () => {
    expect(() =>
      assertAllowedSeedTarget({
        supabaseUrl: "https://unknownref.supabase.co",
        allowedProjectRefs: "stagingref",
      }),
    ).toThrow("no pertenece a ALLOWED_SEED_PROJECT_REFS");
  });

  it("bloquea FINSA PROD aunque se incluya por error en la allowlist", () => {
    expect(() =>
      assertAllowedSeedTarget({
        supabaseUrl: `https://${FINSA_PRODUCTION_PROJECT_REF}.supabase.co`,
        allowedProjectRefs: FINSA_PRODUCTION_PROJECT_REF,
      }),
    ).toThrow("corresponde a FINSA PROD");
  });

  it("bloquea dominios personalizados y URLs remotas sin HTTPS", () => {
    expect(() =>
      assertAllowedSeedTarget({
        supabaseUrl: "https://staging.example.com",
        allowedProjectRefs: "stagingref",
      }),
    ).toThrow("no es un proyecto Supabase explícito");
    expect(() =>
      assertAllowedSeedTarget({
        supabaseUrl: "http://stagingref.supabase.co",
        allowedProjectRefs: "stagingref",
      }),
    ).toThrow("debe usar HTTPS");
  });
});
