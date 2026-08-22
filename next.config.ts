import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import { isClientErrorTrackingBuildEnabled } from "./src/lib/error-tracking/config";

function lanOrigins(): string[] {
  const extras: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const net of addrs ?? []) {
      if (net.family === "IPv4" && !net.internal) extras.push(net.address);
    }
  }
  return extras;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...lanOrigins()],
  env: {
    // Derived at build time from the private canonical flag. It is never an
    // independently managed public switch.
    NEXT_PUBLIC_ERROR_TRACKING_ACTIVE: isClientErrorTrackingBuildEnabled() ? "true" : "false",
  },
  turbopack: {
    root: process.cwd(),
  },
};

// Do not use the Sentry build wrapper in this unit. In 10.70.0 it mutates Next's
// config with client tracing metadata and build instrumentation, which violates
// this unit's tracing-off and minimal-context guardrails.
export default nextConfig;
