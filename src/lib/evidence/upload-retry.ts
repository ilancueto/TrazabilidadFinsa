export const MAX_UPLOAD_ATTEMPTS = 3;

export function uploadRetryDelayMs(failedAttempt: number): number | null {
  if (!Number.isInteger(failedAttempt) || failedAttempt < 1 || failedAttempt >= MAX_UPLOAD_ATTEMPTS) return null;
  return 1000 * 2 ** (failedAttempt - 1);
}

export async function uploadWithRetry<T>(input: {
  operationId: string;
  send: (attempt: 1 | 2 | 3, operationId: string) => Promise<T>;
  wait: (delayMs: number) => Promise<void>;
}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1 as 1 | 2 | 3; attempt <= MAX_UPLOAD_ATTEMPTS; attempt = (attempt + 1) as 1 | 2 | 3) {
    try {
      return await input.send(attempt, input.operationId);
    } catch (error) {
      lastError = error;
      const delayMs = uploadRetryDelayMs(attempt);
      if (delayMs === null) break;
      await input.wait(delayMs);
    }
  }
  throw lastError;
}
