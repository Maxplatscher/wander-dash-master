import { describe, expect, it } from "vitest";
import {
  getDefaultSection,
  getSectionsForRole,
  isSectionAllowed,
  SECTIONS,
} from "./navigation";

describe("rollenabhängige Navigation", () => {
  it("bietet Fahrern ausschließlich die eigene Tour an", () => {
    const sections = getSectionsForRole("driver");

    expect(sections.map((s) => s.id)).toEqual(["fahrer"]);
    expect(sections[0].label).toBe("Meine Tour");
  });

  it("startet Fahrer auf der eigenen Tour und Dispatch auf der Startseite", () => {
    expect(getDefaultSection("driver")).toBe("fahrer");
    expect(getDefaultSection("dispatcher")).toBe("startseite");
    expect(getDefaultSection("admin")).toBe("startseite");
  });

  it("sperrt Dispositionsbereiche ohne Fahrer-Datenrechte", () => {
    for (const id of ["startseite", "kalender", "kontrollzentrale", "probleme", "einstellungen"] as const) {
      expect(isSectionAllowed(id, "driver")).toBe(false);
    }
    expect(isSectionAllowed("fahrer", "driver")).toBe(true);
  });

  it("lässt Admin und Dispatcher unverändert alle Bereiche sehen", () => {
    const all = SECTIONS.map((s) => s.id);

    expect(getSectionsForRole("admin").map((s) => s.id)).toEqual(all);
    expect(getSectionsForRole("dispatcher").map((s) => s.id)).toEqual(all);
    expect(getSectionsForRole("admin").map((s) => s.label)).toEqual(
      SECTIONS.map((s) => s.label),
    );
  });
});
