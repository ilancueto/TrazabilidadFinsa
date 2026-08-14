import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";

function lanIPv4() {
  const nets = networkInterfaces();
  const preferred = [];
  const others = [];
  for (const [name, addrs] of Object.entries(nets)) {
    if (/virtual|vethernet|wsl|loopback|bluetooth|docker|vbox/i.test(name)) continue;
    for (const net of addrs ?? []) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (/wi-?fi|wlan|wifi/i.test(name)) preferred.push(net.address);
      else others.push(net.address);
    }
  }
  return preferred[0] ?? others[0] ?? "127.0.0.1";
}

const ip = lanIPv4();
console.log("");
console.log("PC:     https://localhost:3000  (puede no andar si el host es la IP)");
console.log(`Celular: https://${ip}:3000`);
console.log("Aceptá el certificado en Safari. No uses 0.0.0.0");
console.log("");

const child = spawn(
  "npx",
  ["next", "dev", "--experimental-https", "--hostname", ip],
  { stdio: "inherit", shell: true },
);
child.on("exit", (code) => process.exit(code ?? 0));
