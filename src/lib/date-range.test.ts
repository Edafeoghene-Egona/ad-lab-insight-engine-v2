import { describe, it, expect } from "vitest";
import { defaultRange, isIsoDate } from "./date-range";

describe("date-range", () => {
  it("defaultRange returns a 14-day inclusive ISO window from the given day", () => {
    const r = defaultRange(new Date("2026-06-26T00:00:00Z"));
    expect(r).toEqual({ start: "2026-06-12", end: "2026-06-26" });
  });

  it("isIsoDate accepts YYYY-MM-DD and rejects junk", () => {
    expect(isIsoDate("2026-06-26")).toBe(true);
    expect(isIsoDate("2026-6-2")).toBe(false);
    expect(isIsoDate("nope")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
