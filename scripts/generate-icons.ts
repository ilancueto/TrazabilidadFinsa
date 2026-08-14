import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { solidPng } from "./png";

const dir = join(process.cwd(), "public", "icons");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "icon-192.png"), solidPng(192, 192, [255, 204, 0]));
writeFileSync(join(dir, "icon-512.png"), solidPng(512, 512, [36, 36, 36]));
console.log("icons generated");
