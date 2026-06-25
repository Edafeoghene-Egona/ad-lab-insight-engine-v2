import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import CreativeOS from "./CreativeOS";
import type { PortfolioResponse } from "@/lib/creativeos-types";

const portfolio: PortfolioResponse = {
  window: { start: "2026-06-11", end: "2026-06-25" },
  totals: { spend: 12166, views: 783005, conversions: 137, clientsLive: 2, winRate: 37 },
  clients: [
    {
      customerId: "711-060-6646",
      name: "glowora.com",
      spend: 12166,
      views: 783005,
      viewRate: 0.248,
      avgCpv: 0.012,
      conversions: 137,
      status: { win: 5, test: 12, loss: 3 },
    },
    {
      customerId: "492-118-3320",
      name: "koriderm.com",
      spend: 8900,
      views: 300000,
      viewRate: 0.21,
      avgCpv: 0.014,
      conversions: 80,
      status: { win: 3, test: 8, loss: 2 },
    },
  ],
  errors: [],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CreativeOS />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CreativeOS page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(portfolio), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("auto-pulls the portfolio on open and renders client cards", async () => {
    renderPage();
    expect(await screen.findByText("glowora.com")).toBeInTheDocument();
    expect(screen.getByText("koriderm.com")).toBeInTheDocument();
    // Portfolio view: no pink client header.
    expect(screen.queryByTestId("cos-pink-header")).toBeNull();
  });

  it("shows an error state with retry when the pull fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    renderPage();
    expect(await screen.findByText(/Couldn’t load live data/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry/i)).toBeInTheDocument();
  });
});
