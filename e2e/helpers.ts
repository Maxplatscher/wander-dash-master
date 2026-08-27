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
