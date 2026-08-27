import { test as base, expect } from "@playwright/test";

export { expect };

export const test = base;

export const dispatcherCreds = {
  email: process.env.E2E_DISPATCHER_EMAIL ?? "",
  password: process.env.E2E_DISPATCHER_PASSWORD ?? "",
};

export const driverCreds = {
  email: process.env.E2E_DRIVER_EMAIL ?? "",
  password: process.env.E2E_DRIVER_PASSWORD ?? "",
};

export const driverPinCreds = {
  firstName: process.env.E2E_DRIVER_FIRST ?? "",
  lastName: process.env.E2E_DRIVER_LAST ?? "",
  code: process.env.E2E_DRIVER_CODE ?? "",
};

export async function loginOnDispoTab(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Dispo" }).click();
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}
