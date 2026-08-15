export function logServerError(
  event: string,
  error: unknown,
  context: Record<string, string | number | boolean | null> = {},
) {
  const detail = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
  console.error(JSON.stringify({
    level: "error",
    event,
    at: new Date().toISOString(),
    ...context,
    error: detail,
  }));
}
