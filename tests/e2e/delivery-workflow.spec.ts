import { expect, test } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: import("@playwright/test").Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("CatLocal123!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(next.replaceAll("/", "\\/")));
}

async function logout(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

test("circuito crear → fotografiar → revisar → cerrar", async ({ page }) => {
  const number = `E2E-${Date.now()}`;

  await login(page, "ilan@cat.local", "/admin");
  await page.goto("/admin/deliveries/new");
  await page.getByLabel("Número de entrega").fill(number);
  await page.getByLabel("Destino / cliente").fill("Prueba automatizada");
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/deliveries/${number}$`));
  const detailUrl = page.url();
  await logout(page);

  await login(page, "emilio@cat.local", "/picking");
  await page.getByRole("link", { name: new RegExp(number) }).click();
  const claim = page.getByRole("button", { name: "La tomo yo" });
  if (await claim.isVisible()) await claim.click();

  for (let index = 0; index < 20; index += 1) {
    const ready = page.getByRole("button", { name: "Marcar lista" });
    if (await ready.isVisible()) {
      await ready.click();
      await expect(page.getByText("Entrega marcada como lista")).toBeVisible();
      break;
    }

    const file = page.getByLabel(/^Elegir foto de/);
    if (!(await file.isVisible())) {
      await page.getByRole("link", { name: /^Subir foto:/ }).click();
    }
    await page.getByLabel(/^Elegir foto de/).setInputFiles({
      name: `e2e-${index}.png`,
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    const upload = page.getByRole("button", { name: "Subir foto" });
    await expect(upload).toBeEnabled();
    await upload.click();
    await page.waitForURL(/uploaded=1/);
  }

  await logout(page);
  await login(page, "ilan@cat.local", "/admin");
  await page.goto(`${detailUrl}/revisar`);
  const acceptButtons = page.getByRole("button", { name: "Sirve", exact: true });
  await expect(acceptButtons.first()).toBeVisible();
  const photoCount = await acceptButtons.count();
  expect(photoCount).toBeGreaterThan(0);
  for (let index = 0; index < photoCount; index += 1) {
    await acceptButtons.nth(index).click();
    await expect(page.getByText("Aceptada", { exact: true })).toHaveCount(index + 1);
  }

  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).last().click();
  await expect(page.getByText("Entrega cerrada")).toBeVisible();

  await page.getByRole("button", { name: "Archivar" }).click();
  await page.getByRole("dialog").getByLabel("Número de confirmación").fill(number);
  await page.getByRole("dialog").getByRole("button", { name: "Archivar" }).click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
});
