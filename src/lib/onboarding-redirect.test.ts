import { describe, expect, it } from "vitest";
import {
  OnboardingRedirectState,
  decideOnboardingTarget,
} from "./onboarding-redirect";

function state(overrides: Partial<OnboardingRedirectState> = {}): OnboardingRedirectState {
  return {
    authLoading: false,
    hasUser: true,
    role: "dispatcher",
    roleResolved: true,
    onboardingCompleted: false,
    ...overrides,
  };
}

describe("Weiterleitung nach dem Login", () => {
  it("schickt Fahrer ohne abgeschlossenes Onboarding in die App statt in den Wizard", () => {
    expect(
      decideOnboardingTarget(state({ role: "driver", onboardingCompleted: false })),
    ).toBe("app");
    expect(
      decideOnboardingTarget(state({ role: "driver", onboardingCompleted: null })),
    ).toBe("app");
  });

  it("schickt Disposition und Admin ohne abgeschlossenes Onboarding in den Wizard", () => {
    expect(decideOnboardingTarget(state({ role: "dispatcher" }))).toBe("setup");
    expect(decideOnboardingTarget(state({ role: "admin" }))).toBe("setup");
  });

  it("lässt abgeschlossenes Onboarding in die App", () => {
    expect(decideOnboardingTarget(state({ onboardingCompleted: true }))).toBe("app");
  });

  it("wartet auf die asynchrone Rolle, statt vorschnell nach /setup zu leiten", () => {
    expect(
      decideOnboardingTarget(state({ role: null, roleResolved: false })),
    ).toBe("loading");
    expect(
      decideOnboardingTarget(state({ authLoading: true, roleResolved: false })),
    ).toBe("loading");
  });

  it("hängt bei fehlgeschlagenem Rollen-Abruf nicht und leitet nicht auf Verdacht weiter", () => {
    expect(
      decideOnboardingTarget(
        state({ role: null, roleResolved: true, onboardingCompleted: null }),
      ),
    ).toBe("app");
    expect(
      decideOnboardingTarget(state({ role: null, roleResolved: true })),
    ).toBe("app");
  });

  it("wartet auf den Onboarding-Status nur für Rollen mit Stammdatenrechten", () => {
    expect(
      decideOnboardingTarget(state({ role: "dispatcher", onboardingCompleted: null })),
    ).toBe("loading");
  });

  it("überlässt fehlende Sessions dem Login", () => {
    expect(decideOnboardingTarget(state({ hasUser: false }))).toBe("signin");
  });
});
