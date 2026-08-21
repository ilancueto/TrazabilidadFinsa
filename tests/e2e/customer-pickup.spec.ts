import { expect, test } from "@playwright/test";
import {
  acceptAllEvidence,
  claimDelivery,
  closeDelivery,
  expectAdminHasDelivery,
  expectAdminMissingDelivery,
  expectPickingHasDelivery,
  expectPickingMissingDelivery,
  expectTimeline,
  markReady,
  openPickingDelivery,
  publishDelivery,
  uploadNamedEvidence,
} from "./helpers/app";
import { ADMIN, PICKING, login, logout, uniqueDeliveryNumber } from "./helpers/auth";

test("flujo crítico RETIRA CLIENTE: crear, inbox propio, evidencias FLOOR, READY, cerrar", async ({
  page,
}) => {
  const number = uniqueDeliveryNumber("E2E-R");
  const destination = `Destino Retiro ${number}`;

  await login(page, ADMIN);
  await publishDelivery(page, { number, destination, modality: "CUSTOMER_PICKUP" });
  await expect(page.getByText("Retira cliente", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Transportista")).toBeVisible();
  await expect(page.getByText("—").first()).toBeVisible();
  await expectAdminHasDelivery(page, "/admin/retiros", number);
  await expectAdminMissingDelivery(page, "/admin", number);
  await logout(page);

  await login(page, PICKING);
  await expectPickingHasDelivery(page, "/picking/retiros", number);
  await expectPickingMissingDelivery(page, "/picking", number);
  await openPickingDelivery(page, "/picking/retiros", number);
  await claimDelivery(page);
  await uploadNamedEvidence(page, /Subir foto: Remito/);
  await expect(page.getByRole("link", { name: /Etiquetas Andreani|Subir foto: Etiquetas/ })).toHaveCount(0);
  await markReady(page);
  await logout(page);

  await login(page, ADMIN);
  await page.goto(`/admin/deliveries/${number}/revisar`);
  await acceptAllEvidence(page);
  await page.goto(`/admin/deliveries/${number}`);
  await closeDelivery(page);
  await expect(page.getByText("Cerrada", { exact: true }).first()).toBeVisible();
  await expectTimeline(page, [
    "Publicada",
    "La tomó Picking",
    "Foto cargada",
    "Marcada como lista",
    "Foto revisada",
    "Entrega cerrada",
  ]);
});
