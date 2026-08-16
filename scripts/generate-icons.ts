import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const iconsDir = join(root, "public", "icons");
const logo = readFileSync(join(root, "public", "brand", "cat-pwa-logo.svg"));

mkdirSync(iconsDir, { recursive: true });

async function generateIcon(
  filename: string,
  size: number,
  paddingRatio: number,
) {
  const logoSize = Math.round(size * (1 - paddingRatio * 2));
  const renderedLogo = await sharp(logo)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite([{ input: renderedLogo, gravity: "center" }])
    .png()
    .toFile(join(iconsDir, filename));
}

async function main() {
  await Promise.all([
    generateIcon("icon-192.png", 192, 0.1),
    generateIcon("icon-512.png", 512, 0.1),
    generateIcon("icon-maskable-512.png", 512, 0.2),
    generateIcon("apple-touch-icon.png", 180, 0.12),
  ]);

  console.log("PWA icons generated from the CAT logo");
}

void main();
