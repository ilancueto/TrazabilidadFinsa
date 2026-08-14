import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

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
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
