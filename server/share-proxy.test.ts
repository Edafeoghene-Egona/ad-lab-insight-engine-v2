import { describe, it, expect, vi } from "vitest";
import { resolveShareData } from "./share-proxy.mjs";

/** Build a fake supabase whose maybeSingle() resolves to `row`. */
function fakeSupabase(row: unknown) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { from: () => chain };
}

const deps = (row: unknown, fetchImpl: typeof fetch) => ({
  supabase: fakeSupabase(row),
  fetchImpl,
  webhookKey: "secret",
  n8nUrl: "https://n8n.example/webhook/creativeos",
});

describe("resolveShareData", () => {
  it("returns 404 when the token is unknown", async () => {
    const res = await resolveShareData({ token: "nope" }, deps(null, vi.fn()));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the link is revoked", async () => {
    const res = await resolveShareData(
      { token: "t" },
      deps({ customer_id: "123", revoked: true }, vi.fn()),
    );
    expect(res.status).toBe(403);
  });

  it("calls n8n with the bound customer_id + bearer key and returns its body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ account: { name: "Acme" }, creatives: [] }),
    });
    const res = await resolveShareData(
      { token: "t", start: "2026-06-01", end: "2026-06-14" },
      deps({ customer_id: "123", revoked: false }, fetchImpl),
    );
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain("scope=client");
    expect(calledUrl).toContain("customerId=123");
    expect(calledUrl).toContain("start=2026-06-01");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ account: { name: "Acme" }, creatives: [] });
  });

  it("defaults the date window when start/end are missing or malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await resolveShareData(
      { token: "t", start: "garbage" },
      deps({ customer_id: "123", revoked: false }, fetchImpl),
    );
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toMatch(/start=\d{4}-\d{2}-\d{2}/);
    expect(calledUrl).toMatch(/end=\d{4}-\d{2}-\d{2}/);
  });

  it("overrides account.name with the stored friendly client_name (n8n returns the raw id)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ account: { customerId: "421-410-3450", name: "421-410-3450" }, creatives: [] }),
    });
    const res = await resolveShareData(
      { token: "t" },
      deps({ customer_id: "421-410-3450", client_name: "Aurivita New", revoked: false }, fetchImpl),
    );
    expect(res.status).toBe(200);
    expect((res.body as { account: { name: string } }).account.name).toBe("Aurivita New");
  });

  it("returns 502 when n8n fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const res = await resolveShareData(
      { token: "t" },
      deps({ customer_id: "123", revoked: false }, fetchImpl),
    );
    expect(res.status).toBe(502);
  });
});
