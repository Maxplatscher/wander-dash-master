import { describe, expect, it } from "vitest";
import { formatDateLabel, isValidDate, parseDateInputValue, toDateInputValue } from "./date-input";

describe("date-input", () => {
  it("erkennt ungültige Date-Objekte", () => {
    expect(isValidDate(new Date("not-a-date"))).toBe(false);
    expect(isValidDate(new Date(""))).toBe(false);
    expect(isValidDate(new Date(2026, 7, 22, 12))).toBe(true);
  });

  it("nimmt nur vollständige YYYY-MM-DD entgegen", () => {
    expect(parseDateInputValue("")).toBeNull();
    expect(parseDateInputValue("2026-08")).toBeNull();
    expect(parseDateInputValue("08/22/2026")).toBeNull();
    expect(parseDateInputValue("2026-02-31")).toBeNull();

    const parsed = parseDateInputValue("2026-08-22");
    expect(parsed).not.toBeNull();
    expect(toDateInputValue(parsed!)).toBe("2026-08-22");
  });

  it("formatiert lokal und fällt bei Invalid Date auf heute zurück", () => {
    expect(toDateInputValue(new Date(2026, 7, 22, 12))).toBe("2026-08-22");
    expect(toDateInputValue(new Date("invalid"))).toBe(toDateInputValue(new Date()));
  });

  it("crasht nicht bei toISOString auf Invalid Date, weil der Helper davor greift", () => {
    expect(() => toDateInputValue(new Date(Number.NaN))).not.toThrow();
    expect(formatDateLabel(new Date(Number.NaN))).toBe(formatDateLabel(new Date()));
  });

  it("simuliert das Datumsfeld: leere Zwischenwerte lassen den letzten gültigen Wert stehen", () => {
    let selected = parseDateInputValue("2026-08-22")!;
    const onChange = (value: string) => {
      const next = parseDateInputValue(value);
      if (next) selected = next;
    };
    onChange("");
    onChange("2026-08");
    onChange("08222026");
    expect(toDateInputValue(selected)).toBe("2026-08-22");
    expect(() => selected.toISOString()).not.toThrow();
    onChange("2026-08-24");
    expect(toDateInputValue(selected)).toBe("2026-08-24");
  });
});
