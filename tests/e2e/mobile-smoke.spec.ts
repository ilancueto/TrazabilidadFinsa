import { expect, test } from "@playwright/test";
import { PICKING, login } from "./helpers/auth";

test("login PICKING en viewport móvil", async ({ page }) => {
  await login(page, PICKING);
  await expect(page.getByRole("heading", { name: "Despachos pendientes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menú" })).toBeVisible();
});
