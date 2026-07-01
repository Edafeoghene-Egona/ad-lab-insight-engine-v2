import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TranscriptModal } from "./TranscriptModal";

function renderModal(available: boolean, segments: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ available, segments }) }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TranscriptModal open onOpenChange={() => {}} videoId="abcdefghijk" title="Ad 1" />
    </QueryClientProvider>,
  );
}

describe("TranscriptModal", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders timestamped lines with YouTube deep links", async () => {
    renderModal(true, [{ start: 64, dur: 3, text: "Big hook line" }]);
    await waitFor(() => expect(screen.getByText("Big hook line")).toBeTruthy());
    const link = screen.getByRole("link", { name: /1:04/ });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abcdefghijk&t=64s");
  });

  it("shows a friendly message when no transcript is available", async () => {
    renderModal(false);
    await waitFor(() => expect(screen.getByText(/not available/i)).toBeTruthy());
  });
});
