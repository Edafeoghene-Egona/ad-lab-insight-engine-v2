import { describe, it, expect } from "vitest";
import { defaultRange, normalizeStatus, statusLabel, fmtCompact, ratePct } from "./creativeos";

describe("defaultRange", () => {
  it("returns a 14-day window ending today", () => {
    const r = defaultRange(new Date("2026-06-25T00:00:00Z"));
    expect(r.end).toBe("2026-06-25");
    expect(r.start).toBe("2026-06-11");
  });
});

describe("normalizeStatus", () => {
  it("lowercases and maps known values, unknown->null", () => {
    expect(normalizeStatus("WIN")).toBe("win");
    expect(normalizeStatus("Test")).toBe("test");
    expect(normalizeStatus("Loss")).toBe("loss");
    expect(normalizeStatus("")).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
  });
});

describe("statusLabel", () => {
  it("maps loss to RETIRE, null to dash", () => {
    expect(statusLabel("loss")).toBe("RETIRE");
    expect(statusLabel("win")).toBe("WIN");
    expect(statusLabel(null)).toBe("—");
  });
});

describe("fmtCompact", () => {
  it("compacts thousands and millions", () => {
    expect(fmtCompact(457056)).toBe("457k");
    expect(fmtCompact(1420000)).toBe("1.4M");
    expect(fmtCompact(840)).toBe("840");
  });
});

describe("ratePct", () => {
  it("scales fractions but leaves percentages", () => {
    expect(ratePct(0.322)).toBeCloseTo(32.2);
    expect(ratePct(32.2)).toBeCloseTo(32.2);
    expect(ratePct(1)).toBeCloseTo(100);
  });
});
