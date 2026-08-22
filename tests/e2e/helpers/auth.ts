import { expect, type Page } from "@playwright/test";

/** Synthetic DEV/STAGING credentials from scripts/seed.ts. Never used against production. */
export const ADMIN = {
  email: "ilan@cat.local",
  password: "CatLocal123!",
  home: "/admin",
} as const;

export const PICKING = {
  email: "emilio@cat.local",
  password: "CatLocal123!",
  home: "/picking",
} as const;

export type E2EUser = typeof ADMIN | typeof PICKING;

export function uniqueDeliveryNumber(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function login(page: Page, user: E2EUser, next = user.home) {
  await ensureStagingAccess(page);
  if (new URL(page.url()).pathname !== "/login") {
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
  }
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(next)}(?:\\?|$)`));
}

async function ensureStagingAccess(page: Page) {
  const accessURL = process.env.STAGING_ACCESS_URL;
  if (!accessURL) return;

  const accessHost = new URL(accessURL).hostname;
  const cookies = await page.context().cookies(`https://${accessHost}`);
  if (cookies.some((cookie) => cookie.name.toLowerCase().includes("vercel"))) return;

  await page.goto(accessURL, { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");
}

export async function logout(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
