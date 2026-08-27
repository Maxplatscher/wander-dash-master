import { expect, test, driverCreds, driverPinCreds, loginOnDispoTab } from "./helpers";

test.describe("Fahrer-Kernflow", () => {
  test.skip(
    !driverCreds.email || !driverCreds.password,
    "E2E_DRIVER_EMAIL/PASSWORD in .env.test setzen",
  );

  test("meldet sich per E-Mail auf dem Dispo-Tab an und sieht Meine Tour", async ({ page }) => {
    await loginOnDispoTab(page, driverCreds.email, driverCreds.password);
    await expect(
      page.getByRole("button", { name: "Meine Tour" }).or(page.getByText("Meine Tour")),
    ).toBeVisible({ timeout: 25_000 });
  });
});

test.describe("Fahrer-Code-Login", () => {
  test.skip(
    !driverPinCreds.firstName || !driverPinCreds.lastName || !driverPinCreds.code,
    "E2E_DRIVER_FIRST/LAST/CODE in .env.test setzen",
  );

  test("meldet sich über den Fahrer-Tab mit Name und Code an", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Fahrer" }).click();
    await page.getByLabel("Vorname").fill(driverPinCreds.firstName);
    await page.getByLabel("Nachname").fill(driverPinCreds.lastName);
    await page.getByLabel("Code").fill(driverPinCreds.code);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(
      page.getByRole("button", { name: "Meine Tour" }).or(page.getByText("Meine Tour")),
    ).toBeVisible({ timeout: 25_000 });
  });
});
