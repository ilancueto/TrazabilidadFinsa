import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { ADMIN, PICKING, escapeRegExp, login, logout } from "./auth";

export const EVIDENCE_FIXTURE = path.join(process.cwd(), "tests/e2e/fixtures/evidence.png");

const FLOOR_ONLY_KEEP = ["Remito"];
const DESPACHO_KEEP = ["Remito", "Etiquetas Andreani"];

export async function publishDelivery(
  page: Page,
  options: {
    number: string;
    destination: string;
    modality: "DESPACHO" | "CUSTOMER_PICKUP";
  },
) {
  await page.goto("/admin/deliveries/new");
  await expect(page.getByRole("heading", { name: "Nueva entrega" })).toBeVisible();
  await page.getByLabel("Número de entrega").fill(options.number);
  await page.getByLabel("Modalidad").selectOption({
    label: options.modality === "DESPACHO" ? "Despacho" : "Retira cliente",
  });
  if (options.modality === "DESPACHO") {
    await expect(page.getByText("Etiquetas Andreani")).toBeVisible();
  } else {
    await expect(page.getByText("Etiquetas Andreani")).toHaveCount(0);
  }
  await page.getByLabel("Destino / Detalle").fill(options.destination);
  await keepRequirements(page, options.modality === "DESPACHO" ? DESPACHO_KEEP : FLOOR_ONLY_KEEP);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/deliveries/${escapeRegExp(options.number)}$`));
  await expect(page.getByRole("heading", { name: options.number })).toBeVisible();
}

async function keepRequirements(page: Page, labels: string[]) {
  const section = page.locator("section").filter({ hasText: "Qué hay que fotografiar" });
  const rows = section.getByRole("listitem");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const firstLine =
      (await row.innerText())
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean) ?? "";
    const applies = row.getByRole("checkbox", { name: "Aplica" });
    if (labels.includes(firstLine)) {
      await applies.check();
    } else if (await applies.isEnabled()) {
      await applies.uncheck();
    }
  }
}

export async function expectAdminHasDelivery(page: Page, basePath: "/admin" | "/admin/retiros", number: string) {
  await page.goto(`${basePath}?q=${encodeURIComponent(number)}`);
  await expect(page.getByRole("link", { name: number, exact: true })).toBeVisible();
}

export async function expectAdminMissingDelivery(
  page: Page,
  basePath: "/admin" | "/admin/retiros",
  number: string,
) {
  await page.goto(`${basePath}?q=${encodeURIComponent(number)}`);
  await expect(page.getByRole("link", { name: number, exact: true })).toHaveCount(0);
  await expect(page.getByText("No hay entregas con ese filtro.")).toBeVisible();
}

export async function expectPickingHasDelivery(
  page: Page,
  basePath: "/picking" | "/picking/retiros",
  number: string,
) {
  await page.goto(`${basePath}?q=${encodeURIComponent(number)}`);
  await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(number)) }).first()).toBeVisible();
}

export async function expectPickingMissingDelivery(
  page: Page,
  basePath: "/picking" | "/picking/retiros",
  number: string,
) {
  await page.goto(`${basePath}?q=${encodeURIComponent(number)}`);
  await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(number)) })).toHaveCount(0);
  await expect(page.getByText(/No hay (despachos|retiros) con esa búsqueda/)).toBeVisible();
}

export async function openPickingDelivery(
  page: Page,
  basePath: "/picking" | "/picking/retiros",
  number: string,
) {
  await expectPickingHasDelivery(page, basePath, number);
  await page.getByRole("link", { name: new RegExp(escapeRegExp(number)) }).first().click();
  await expect(page.getByRole("heading", { name: number })).toBeVisible();
}

export async function claimDelivery(page: Page) {
  await page.getByRole("button", { name: "La tomo yo" }).click();
  await expect(page.getByText("Esta entrega quedó a tu nombre")).toBeVisible();
  await expect(page.getByRole("button", { name: "Soltar" })).toBeVisible();
}

export async function uploadNamedEvidence(page: Page, linkName: RegExp | string) {
  const link =
    typeof linkName === "string"
      ? page.getByRole("link", { name: linkName, exact: true })
      : page.getByRole("link", { name: linkName });
  await expect(link.first()).toBeVisible();
  const href = await link.first().getAttribute("href");
  await link.first().click();
  await uploadCurrentEvidence(page);
  return href;
}

export async function uploadCurrentEvidence(page: Page) {
  const gallery = page.getByLabel(/Elegir fotos de la galería/);
  await gallery.setInputFiles(EVIDENCE_FIXTURE);
  await expect(page.getByText(/Fotos seleccionadas/)).toBeVisible();
  const submit = page.getByRole("button", { name: /Subir 1 foto/ });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Foto guardada")).toBeVisible();
}

export async function markReady(page: Page) {
  await page.getByRole("button", { name: "Marcar lista" }).click();
  await expect(page.getByText("Entrega marcada como lista")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Lista", { exact: true }).first()).toBeVisible();
}

export async function acceptAllEvidence(page: Page) {
  const buttons = page.getByRole("button", { name: /Sirve/ });
  await expect(buttons.first()).toBeVisible();
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await buttons.nth(index).click();
    await expect(page.getByText("Aceptada", { exact: true })).toHaveCount(index + 1);
  }
}

export async function closeDelivery(page: Page) {
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Cerrar entrega" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).last().click();
  await expect(page.getByText("Entrega cerrada").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cerrada", { exact: true }).first()).toBeVisible();
}

export async function expectTimeline(page: Page, events: string[]) {
  await expect(page.getByRole("heading", { name: "Historial" })).toBeVisible();
  for (const event of events) {
    await expect(page.getByText(event).first()).toBeVisible();
  }
}

export async function prepareReadyDelivery(
  page: Page,
  options: {
    number: string;
    destination: string;
    modality: "DESPACHO" | "CUSTOMER_PICKUP";
    uploadDispatch?: boolean;
  },
) {
  await login(page, ADMIN);
  await publishDelivery(page, options);
  await logout(page);
  await login(page, PICKING);
  const inbox = options.modality === "DESPACHO" ? "/picking" : "/picking/retiros";
  await openPickingDelivery(page, inbox, options.number);
  await claimDelivery(page);
  const floorCaptureUrl = await uploadNamedEvidence(page, /Subir foto: Remito/);
  await markReady(page);
  if (options.modality === "DESPACHO" && options.uploadDispatch !== false) {
    await uploadNamedEvidence(page, "Subir foto");
  }
  return { floorCaptureUrl };
}
