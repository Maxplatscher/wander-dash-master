import { afterEach, describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  getAccent,
  loadAppearance,
  saveAppearance,
} from "./appearance";

describe("appearance", () => {
  afterEach(() => {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    document.documentElement.style.removeProperty("--primary");
    delete document.documentElement.dataset.density;
  });

  it("fällt auf Cyan / Dunkel / Ausgewogen zurück", () => {
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(getAccent("cyan").hex).toBe("#7ce8f5");
  });

  it("ignoriert unbekannte Werte und erzwingt Dark-Mode", () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ accent: "neon", mode: "light", density: "compact" }),
    );
    expect(loadAppearance()).toEqual({
      accent: "cyan",
      mode: "dark",
      density: "compact",
    });
  });

  it("setzt --primary und data-density am Dokument", () => {
    applyAppearance({ accent: "salbei", mode: "light", density: "airy" });
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
      "147 71% 67%",
    );
    expect(document.documentElement.dataset.density).toBe("airy");
    expect(document.documentElement.dataset.colorMode).toBe("dark");
  });

  it("speichert ohne Light-Mode", () => {
    saveAppearance({ accent: "bernstein", mode: "light", density: "compact" });
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "{}")).toEqual({
      accent: "bernstein",
      mode: "dark",
      density: "compact",
    });
  });
});
