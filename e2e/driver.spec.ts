import { expect, test, driverCreds } from "./helpers";

test.describe("Fahrer-Kernflow", () => {
  test.skip(
    !driverCreds.email || !driverCreds.password,
    "E2E_DRIVER_EMAIL/PASSWORD in .env.test setzen",
  );

  test("meldet sich an und sieht Meine Tour", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("E-Mail").fill(driverCreds.email);
    await page.getByLabel("Passwort").fill(driverCreds.password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(
      page.getByRole("button", { name: "Meine Tour" }).or(page.getByText("Meine Tour")),
    ).toBeVisible({ timeout: 25_000 });
  });
});
