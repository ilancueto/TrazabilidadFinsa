import { expect, test } from "@playwright/test";
import { publishDelivery } from "./helpers/app";
import { ADMIN, PICKING, SUPERVISOR, login, logout, uniqueDeliveryNumber } from "./helpers/auth";

test("auditoría: ADMIN filtra y PICKING es redirigido", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-AUDIT");
  await login(page, ADMIN);
  await publishDelivery(page, { number, destination: "Auditoría E2E", modality: "DESPACHO" });
  await page.goto(`/admin/auditoria?delivery=${encodeURIComponent(number)}&action=PUBLISHED`);
  await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await expect(page.getByText("Publicada", { exact: true })).toBeVisible();
  await page.getByLabel("Motivo").fill("sin coincidencias");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("No hay eventos para esos filtros.")).toBeVisible();
  await logout(page);
  await login(page, SUPERVISOR);
  await page.goto(`/admin/auditoria?delivery=${encodeURIComponent(number)}&action=PUBLISHED`);
  await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
  await expect(page.getByText(number, { exact: true })).toBeVisible();
  await logout(page);
  await login(page, PICKING);
  await page.goto("/admin/auditoria");
  await expect(page).toHaveURL(/\/picking/);
});

test("archivo histórico: ADMIN ve evento y detalle sin controles mutables", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-ARCH");
  await login(page, ADMIN);
  await publishDelivery(page, { number, destination: "Archivo E2E", modality: "DESPACHO" });
  await page.getByRole("button", { name: "Eliminar entrega" }).click();
  const dialog = page.getByRole("dialog", { name: "Eliminar entrega" });
  await dialog.getByLabel("Número de confirmación").fill(number);
  await dialog.getByRole("button", { name: "Eliminar entrega" }).last().click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  await page.goto(`/admin/auditoria?delivery=${encodeURIComponent(number)}&action=ARCHIVED`);
  await expect(page.getByText("Entrega archivada", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: number, exact: true }).click();
  await expect(page.getByText(/sólo lectura/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Cerrar|Archivar|La tomo yo|Marcar lista/ })).toHaveCount(0);
});
