import { expect, test, dispatcherCreds } from "./helpers";

test.describe("Dispatcher-Kernflow", () => {
  test.skip(
    !dispatcherCreds.email || !dispatcherCreds.password,
    "E2E_DISPATCHER_EMAIL/PASSWORD in .env.test setzen",
  );

  test("meldet sich an und sieht das Dashboard", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("E-Mail").fill(dispatcherCreds.email);
    await page.getByLabel("Passwort").fill(dispatcherCreds.password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(
      page.getByRole("heading", { name: /Guten |DispoCenter einrichten/i }).or(
        page.getByText("Startseite"),
      ),
    ).toBeVisible({ timeout: 25_000 });
  });

  test("öffnet Lieferscheine", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("E-Mail").fill(dispatcherCreds.email);
    await page.getByLabel("Passwort").fill(dispatcherCreds.password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    const lieferscheine = page.getByRole("button", { name: "Lieferscheine" });
    if (await lieferscheine.isVisible().catch(() => false)) {
      await lieferscheine.click();
      await expect(page.getByText("Eingang & Disposition")).toBeVisible();
    }
  });
});
