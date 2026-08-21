import { expect, test } from "@playwright/test";
import {
  closeDelivery,
  prepareReadyDelivery,
  publishDelivery,
  uploadNamedEvidence,
} from "./helpers/app";
import { ADMIN, PICKING, login, logout, uniqueDeliveryNumber } from "./helpers/auth";

test("observación abierta bloquea el cierre y luego permite cerrar", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-O");
  await prepareReadyDelivery(page, {
    number,
    destination: `Obs ${number}`,
    modality: "CUSTOMER_PICKUP",
  });
  await logout(page);

  await login(page, ADMIN);
  await page.goto(`/admin/deliveries/${number}`);
  await page.getByLabel("Nueva observación").fill("Falta precinto E2E");
  await page.getByRole("button", { name: "Agregar observación" }).click();
  await expect(page.getByText("Observación registrada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Resolver observación" }).click();
  await expect(page.getByText("Observación resuelta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeEnabled();
  await closeDelivery(page);
  await expect(page.getByText("Cerrada", { exact: true }).first()).toBeVisible();
});

test("FLOOR no se puede cargar cuando la entrega está READY", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-F");
  const { floorCaptureUrl } = await prepareReadyDelivery(page, {
    number,
    destination: `Floor Ready ${number}`,
    modality: "DESPACHO",
    uploadDispatch: false,
  });

  await expect(page.getByRole("link", { name: /Subir foto: / })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Subir foto", exact: true })).toBeVisible();

  expect(floorCaptureUrl).toBeTruthy();
  await page.goto(floorCaptureUrl!);
  await expect(page.getByText("Ahora no se pueden cargar fotos en esta entrega.")).toBeVisible();
  await expect(page.getByLabel(/Elegir fotos de la galería/)).toHaveCount(0);
});

test("anular evidencia la saca del progreso activo", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-V");
  await login(page, ADMIN);
  await publishDelivery(page, {
    number,
    destination: `Anular ${number}`,
    modality: "CUSTOMER_PICKUP",
  });
  await logout(page);

  await login(page, PICKING);
  await page.goto(`/picking/${number}`);
  await page.getByRole("button", { name: "La tomo yo" }).click();
  await uploadNamedEvidence(page, /Subir foto: Remito/);
  await expect(page.getByText("ok", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Anular" }).click();
  const dialog = page.getByRole("dialog", { name: "Anular foto" });
  await dialog.getByLabel("Motivo").fill("Foto de prueba E2E");
  await dialog.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText("ok", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Todavía sin foto")).toBeVisible();
  await expect(page.getByText("falta", { exact: true })).toBeVisible();
  await expect(page.getByText("Foto anulada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar lista" })).toHaveCount(0);
});

test("ADMIN reabre una entrega cerrada a IN_PICKING con motivo visible", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-P");
  await prepareReadyDelivery(page, {
    number,
    destination: `Reabrir ${number}`,
    modality: "CUSTOMER_PICKUP",
  });
  await logout(page);

  await login(page, ADMIN);
  await page.goto(`/admin/deliveries/${number}`);
  await closeDelivery(page);

  await page.getByRole("button", { name: "Reabrir" }).click();
  const dialog = page.getByRole("dialog", { name: "Reabrir entrega" });
  await dialog.getByLabel("Motivo").fill("Reapertura E2E");
  await dialog.getByRole("button", { name: "Reabrir" }).click();

  await expect(page.getByText("Entrega reabierta").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("En Picking").first()).toBeVisible();
  await expect(page.getByText("Reapertura E2E")).toBeVisible();
});

test("Publicar se deshabilita durante el envío y no crea un duplicado evidente", async ({ page }) => {
  const number = uniqueDeliveryNumber("E2E-X");
  await login(page, ADMIN);
  await page.goto("/admin/deliveries/new");
  await page.getByLabel("Número de entrega").fill(number);
  await page.getByLabel("Modalidad").selectOption({ label: "Retira cliente" });
  await page.getByLabel("Destino / Detalle").fill(`Doble submit ${number}`);
  const publish = page.getByRole("button", { name: "Publicar", exact: true });
  await publish.click();
  await expect(page.getByRole("button", { name: /Publicar|Guardando/ })).toBeDisabled();
  await expect(page).toHaveURL(new RegExp(`/admin/deliveries/${number}$`));
  await expect(page.getByRole("heading", { name: number })).toBeVisible();
});
