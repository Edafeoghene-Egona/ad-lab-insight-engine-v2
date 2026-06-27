import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ClientShareView from "./ClientShareView";

function renderAt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/c/tok"]}>
        <Routes>
          <Route path="/c/:token" element={<ClientShareView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const validPayload = {
  window: { start: "2026-06-12", end: "2026-06-26" },
  account: { customerId: "123", name: "Acme" },
  benchmarks: { viewRate: 0.3, hook: 0.5, cpv: 0.02 },
  creatives: [],
  daily: [],
};

describe("ClientShareView", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows an inactive message on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
    renderAt();
    await waitFor(() => expect(screen.getByText(/no longer active/i)).toBeTruthy());
  });

  it("renders the deep dive without Command Center or a client switcher", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(validPayload) }),
    );
    renderAt();
    // Client name appears (pink header), Command Center tab is absent.
    await waitFor(() => expect(screen.getAllByText(/Acme/).length).toBeGreaterThan(0));
    expect(screen.queryByText("Command Center")).toBeNull();
    expect(screen.getByText("Creative Testing Lab")).toBeTruthy();
  });
});
