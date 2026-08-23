import { readFile } from "node:fs/promises";
import { aggregateTechnicalMetricsNdjson } from "@/lib/technical-metrics";

function argument(name: string): string {
  const position = process.argv.indexOf(name);
  const value = position >= 0 ? process.argv[position + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const input = argument("--input");
  const start = argument("--start");
  const end = argument("--end");
  const sourceState = process.argv.includes("--source-incomplete") ? "UNKNOWN" : "AVAILABLE" as const;
  const ndjson = await readFile(input, "utf8");
  const report = aggregateTechnicalMetricsNdjson(ndjson, { start, end }, {
    logs: sourceState,
    auditEvents: sourceState,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Technical metrics aggregation failed"}\n`);
  process.exitCode = 1;
});
