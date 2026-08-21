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

test("flujo crítico DESPACHO: crear, tomar, FLOOR, READY, DISPATCH, revisar, cerrar", async ({
  page,
}) => {
  const number = uniqueDeliveryNumber("E2E-D");
  const destination = `Destino Despacho ${number}`;

  await login(page, ADMIN);
  await publishDelivery(page, { number, destination, modality: "DESPACHO" });
  await expect(page.getByText("Despacho", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Andreani", { exact: true })).toBeVisible();
  await expect(page.getByText(destination).first()).toBeVisible();
  await expectAdminHasDelivery(page, "/admin", number);
  await expectAdminMissingDelivery(page, "/admin/retiros", number);
  await logout(page);

  await login(page, PICKING);
  await expectPickingHasDelivery(page, "/picking", number);
  await expectPickingMissingDelivery(page, "/picking/retiros", number);
  await openPickingDelivery(page, "/picking", number);
  await claimDelivery(page);
  await uploadNamedEvidence(page, /Subir foto: Remito/);
  await expect(page.getByText("ok", { exact: true }).first()).toBeVisible();
  await markReady(page);
  await expect(page.getByRole("link", { name: /Subir foto: / })).toHaveCount(0);
  await uploadNamedEvidence(page, "Subir foto");
  await expect(page.getByText("ok", { exact: true })).toHaveCount(2);
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
