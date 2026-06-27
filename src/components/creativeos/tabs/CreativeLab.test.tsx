import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreativeLab } from "./CreativeLab";
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

// A loss creative has the highest view rate (so the unfiltered top-3 would surface it),
// and "Tail" has the lowest VVR (so it never lands in the top-3 hero cards).
const data: ClientResponse = {
  window: { start: "2026-06-12", end: "2026-06-26" },
  account: { customerId: "123", name: "Acme" },
  benchmarks: { viewRate: 0.3, hook: 0.2, cpv: 0.02 },
  creatives: [
    mk({ videoId: "lossTop", title: "Loss Leader", viewRate: 0.9, status: "loss" }),
    mk({ videoId: "winOne", title: "Win One", viewRate: 0.5, status: "win" }),
    mk({ videoId: "winTwo", title: "Win Two", viewRate: 0.45, status: "win" }),
    mk({ videoId: "testMid", title: "Test Mid", viewRate: 0.35, status: "test" }),
    mk({ videoId: "tailvid", title: "Tail Creative", viewRate: 0.1, status: "test" }),
  ],
  daily: [],
};

const renderLab = (statusFilter: "all" | "win" | "test" | "loss") =>
  render(
    <CreativeLab data={data} sub="Leaderboard" statusFilter={statusFilter} search="" onOpenCreative={() => {}} />,
  );

describe("CreativeLab leaderboard — top creatives honour the status filter", () => {
  it("hides a high-VVR loss creative entirely when filtering to Win", () => {
    renderLab("win");
    // Previously the loss creative leaked into the top-3 hero cards despite the Win filter.
    expect(screen.queryByText("Loss Leader")).toBeNull();
    expect(screen.getAllByText("Win One").length).toBeGreaterThan(0);
  });

  it("shows the loss creative when the filter is All", () => {
    renderLab("all");
    expect(screen.getAllByText("Loss Leader").length).toBeGreaterThan(0);
  });

  it("exposes a direct YouTube link on a leaderboard row (a creative not in the top-3)", () => {
    renderLab("all");
    // "Tail Creative" has the lowest VVR, so it only appears as a table row, never a hero card.
    const links = screen.getAllByRole("link", { name: /youtube/i });
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://www.youtube.com/watch?v=tailvid");
  });
});
