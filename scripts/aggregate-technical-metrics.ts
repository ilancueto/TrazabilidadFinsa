import { readFile } from "node:fs/promises";
import { aggregateTechnicalMetricsNdjson } from "@/lib/technical-metrics";

function argument(name: string): string {
  const position = process.argv.indexOf(name);
  const value = position >= 0 ? process.argv[position + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Missing ${name}`);
  return value;
}

function availabilityArgument(name: string): "AVAILABLE" | "UNKNOWN" {
  const value = argument(name).toUpperCase();
  if (value === "AVAILABLE" || value === "UNKNOWN") return value;
  throw new Error(`${name} must be AVAILABLE or UNKNOWN`);
}

async function main() {
  const input = argument("--input");
  const start = argument("--start");
  const end = argument("--end");
  const logs = availabilityArgument("--logs");
  const auditEvents = availabilityArgument("--audit-events");
  const ndjson = await readFile(input, "utf8");
  const report = aggregateTechnicalMetricsNdjson(ndjson, { start, end }, {
    logs,
    auditEvents,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Technical metrics aggregation failed"}\n`);
  process.exitCode = 1;
});
