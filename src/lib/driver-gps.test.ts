import { describe, expect, it } from "vitest";
import {
  classifyGpsFix,
  formatGpsAge,
  gpsBadgeLabel,
  GPS_FRESH_MS,
  GPS_USABLE_MS,
} from "./driver-gps";

const NOW = Date.parse("2026-08-22T12:00:00Z");

describe("driver GPS freshness", () => {
  it("nimmt frische genaue Fixes und verwirft grobe oder alte", () => {
    expect(
      classifyGpsFix({ recordedAt: new Date(NOW - 30_000).toISOString(), accuracyM: 20 }, NOW),
    ).toBe("fresh");
    expect(
      classifyGpsFix(
        { recordedAt: new Date(NOW - GPS_FRESH_MS - 1_000).toISOString(), accuracyM: 20 },
        NOW,
      ),
    ).toBe("stale");
    expect(
      classifyGpsFix(
        { recordedAt: new Date(NOW - GPS_USABLE_MS - 1_000).toISOString(), accuracyM: 20 },
        NOW,
      ),
    ).toBe("expired");
    expect(
      classifyGpsFix({ recordedAt: new Date(NOW).toISOString(), accuracyM: 400 }, NOW),
    ).toBe("expired");
  });

  it("beschriftet das Alter und nennt es nie Live-Standort", () => {
    expect(formatGpsAge(new Date(NOW - 20_000).toISOString(), NOW)).toBe("gerade eben");
    expect(formatGpsAge(new Date(NOW - 12 * 60_000).toISOString(), NOW)).toBe("vor 12 Min");
    expect(gpsBadgeLabel([], NOW)).toBe("Keine GPS-Ortung");
    expect(
      gpsBadgeLabel(
        [{ recordedAt: new Date(NOW - 90_000).toISOString(), accuracyM: 15 }],
        NOW,
      ),
    ).toBe("GPS vor 2 Min");
    expect(gpsBadgeLabel([{ recordedAt: new Date(NOW).toISOString(), accuracyM: 15 }], NOW)).not.toMatch(
      /Live/,
    );
  });
});
