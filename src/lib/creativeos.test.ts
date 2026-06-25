import { describe, it, expect } from "vitest";
import { defaultRange, normalizeStatus, statusLabel } from "./creativeos";

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
