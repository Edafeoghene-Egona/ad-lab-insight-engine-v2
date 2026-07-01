import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreativeDrawer } from "./CreativeDrawer";
import type { Creative } from "@/lib/creativeos-types";

const base: Creative = {
  videoId: "abcdefghijk",
  title: "Ad 1",
  format: "In-stream",
  durationSec: 30,
  impressions: 1000,
  views: 500,
  viewRate: 0.3,
  avgCpv: 0.02,
  cost: 100,
  conversions: 5,
  conversionsValue: 200,
  quartiles: null,
  status: "win",
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("CreativeDrawer transcript entry point", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ available: false }) }),
    ),
  );

  it("shows View transcript when the creative has a videoId", () => {
    wrap(<CreativeDrawer creative={base} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /view transcript/i })).toBeTruthy();
  });

  it("hides View transcript when there is no videoId", () => {
    wrap(<CreativeDrawer creative={{ ...base, videoId: null }} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /view transcript/i })).toBeNull();
  });
});
