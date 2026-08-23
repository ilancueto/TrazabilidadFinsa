import { getPublicSupabaseConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const HEALTH_TIMEOUT_MS = 5_000;

export type HealthDependency = "configuration" | "database" | "auth" | "storage";
type Reachability = "reachable" | "unreachable";

export type HealthCheckResult = {
  ok: boolean;
  database: Reachability;
  auth: Reachability;
  storage: Reachability;
  databaseLatencyMs: number;
  failedDependency?: HealthDependency;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type DatabaseResult = {
  state: Reachability;
  latencyMs: number;
};

function unreachableResult(failedDependency: HealthDependency): HealthCheckResult {
  return {
    ok: false,
    database: "unreachable",
    auth: "unreachable",
    storage: "unreachable",
    databaseLatencyMs: 0,
    failedDependency,
  };
}

async function checkDatabase(supabase: AdminClient): Promise<DatabaseResult> {
  const startedAt = performance.now();
  try {
    const { error } = await supabase
      .from("requirement_types")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(HEALTH_TIMEOUT_MS))
      .retry(false);

    return {
      state: error ? "unreachable" : "reachable",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return { state: "unreachable", latencyMs: Math.round(performance.now() - startedAt) };
  }
}

async function checkAuth(url: string, anonKey: string): Promise<Reachability> {
  try {
    const response = await fetch(new URL("/auth/v1/health", url), {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}

function withinTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Health check timed out")), HEALTH_TIMEOUT_MS);
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function checkStorage(supabase: AdminClient): Promise<Reachability> {
  try {
    // storage-js does not expose a per-operation AbortSignal. Bound the public
    // health response while its read-only request settles in the background.
    const { error } = await withinTimeout(supabase.storage.getBucket("evidences"));
    return error ? "unreachable" : "reachable";
  } catch {
    return "unreachable";
  }
}

export async function checkApplicationHealth(): Promise<HealthCheckResult> {
  let supabase: AdminClient;
  let config: ReturnType<typeof getPublicSupabaseConfig>;

  try {
    config = getPublicSupabaseConfig();
    supabase = createAdminClient();
  } catch {
    return unreachableResult("configuration");
  }

  const [databaseResult, auth, storage] = await Promise.all([
    checkDatabase(supabase),
    checkAuth(config.url, config.anonKey),
    checkStorage(supabase),
  ]);

  const failedDependency =
    databaseResult.state === "unreachable"
      ? "database"
      : auth === "unreachable"
        ? "auth"
        : storage === "unreachable"
          ? "storage"
          : undefined;

  return {
    ok: !failedDependency,
    database: databaseResult.state,
    auth,
    storage,
    databaseLatencyMs: databaseResult.latencyMs,
    ...(failedDependency ? { failedDependency } : {}),
  };
}
