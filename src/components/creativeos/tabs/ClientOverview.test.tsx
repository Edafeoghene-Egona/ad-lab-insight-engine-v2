import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientOverview } from "./ClientOverview";
import type { ClientResponse, Creative } from "@/lib/creativeos-types";

const mk = (over: Partial<Creative>): Creative => ({
  videoId: "vid",
  title: "Untitled",
  format: "In-stream",
  durationSec: 30,
  impressions: 1000,
  views: 500,
  viewRate: 0.3,
  avgCpv: 0.02,
  cost: 100,
  conversions: 5,
  conversionsValue: 200,
  quartiles: { p25: 0.6, p50: 0.4, p75: 0.3, p100: 0.2 },
  status: "test",
  ...over,
});

const data: ClientResponse = {
  window: { start: "2026-06-12", end: "2026-06-26" },
  account: { customerId: "123", name: "Acme" },
  benchmarks: { viewRate: 0.3, hook: 0.2, cpv: 0.02 },
  creatives: [
    mk({ videoId: "a", status: "win" }),
    mk({ videoId: "b", status: "win" }),
    mk({ videoId: "c", status: "test" }),
    mk({ videoId: "d", status: "loss" }),
  ],
  daily: [],
};

describe("ClientOverview", () => {
  it("renders the performance overview with the date range", () => {
    render(<ClientOverview data={data} onOpenCreative={() => {}} />);
    expect(screen.getByText("Performance overview")).toBeTruthy();
    expect(screen.getByText(/Jun 12 – Jun 26/)).toBeTruthy();
  });

  it("computes win rate from this client's classified creatives (2 win / 4 = 50%)", () => {
    render(<ClientOverview data={data} onOpenCreative={() => {}} />);
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("2 win")).toBeTruthy();
    expect(screen.getByText("1 retire")).toBeTruthy();
  });
});
