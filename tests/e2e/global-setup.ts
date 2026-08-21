function assertLocalHost(value: string | undefined, label: string) {
  if (!value) return;
  const host = new URL(value).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`E2E refused a non-local ${label}: ${value}`);
  }
}

export default async function globalSetup() {
  assertLocalHost(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000", "E2E_BASE_URL");
  assertLocalHost(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}
