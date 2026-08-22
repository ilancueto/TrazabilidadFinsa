const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

// Defense in depth: this ref remains forbidden even if it is accidentally
// included in ALLOWED_SEED_PROJECT_REFS.
export const FINSA_PRODUCTION_PROJECT_REF = "jbhbjazagiwyryujnenv";

type SeedTarget =
  | { environment: "local"; projectRef: null }
  | { environment: "staging"; projectRef: string };

function projectRefs(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function assertAllowedSeedTarget({
  supabaseUrl,
  allowedProjectRefs = process.env.ALLOWED_SEED_PROJECT_REFS,
  productionProjectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF,
}: {
  supabaseUrl: string;
  allowedProjectRefs?: string;
  productionProjectRef?: string;
}): SeedTarget {
  let target: URL;
  try {
    target = new URL(supabaseUrl);
  } catch {
    throw new Error("Seed bloqueado: NEXT_PUBLIC_SUPABASE_URL no es una URL válida");
  }

  if (LOCAL_HOSTNAMES.has(target.hostname)) {
    return { environment: "local", projectRef: null };
  }

  if (target.protocol !== "https:") {
    throw new Error("Seed remoto bloqueado: el target debe usar HTTPS");
  }

  const suffix = ".supabase.co";
  if (!target.hostname.endsWith(suffix)) {
    throw new Error("Seed remoto bloqueado: el target no es un proyecto Supabase explícito");
  }

  const projectRef = target.hostname.slice(0, -suffix.length);
  if (!projectRef || projectRef.includes(".")) {
    throw new Error("Seed remoto bloqueado: no se pudo identificar un project ref único");
  }

  const forbidden = projectRefs(productionProjectRef);
  forbidden.add(FINSA_PRODUCTION_PROJECT_REF);
  if (forbidden.has(projectRef)) {
    throw new Error("Seed remoto bloqueado: el target corresponde a FINSA PROD");
  }

  if (!projectRefs(allowedProjectRefs).has(projectRef)) {
    throw new Error(
      "Seed remoto bloqueado: el project ref no pertenece a ALLOWED_SEED_PROJECT_REFS",
    );
  }

  return { environment: "staging", projectRef };
}
