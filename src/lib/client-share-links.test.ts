import { describe, it, expect, vi } from "vitest";
import { generateShareToken, shareUrl, getOrCreateShareLink } from "./client-share-links";

describe("share token + url", () => {
  it("generateShareToken returns a long url-safe string", () => {
    const t = generateShareToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateShareToken()).not.toBe(t);
  });

  it("shareUrl builds an absolute /c/<token> link", () => {
    expect(shareUrl("abc", "https://app.ad-lab.io")).toBe("https://app.ad-lab.io/c/abc");
  });
});

describe("getOrCreateShareLink", () => {
  it("returns the existing row when one already exists", async () => {
    const existing = { id: "1", customer_id: "123", client_name: "Acme", token: "tok", revoked: false };
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }) }),
      }),
    };
    const row = await getOrCreateShareLink({ customerId: "123", clientName: "Acme" }, { supabase, userId: "u1" });
    expect(row).toEqual(existing);
  });

  it("inserts a new row (with a generated token) when none exists", async () => {
    const insertSpy = vi.fn((payload) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: "2", ...payload }, error: null }) }),
    }));
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: insertSpy,
      }),
    };
    const row = await getOrCreateShareLink({ customerId: "999", clientName: "Beta" }, { supabase, userId: "u1" });
    expect(insertSpy).toHaveBeenCalledOnce();
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.customer_id).toBe("999");
    expect(payload.client_name).toBe("Beta");
    expect(payload.created_by).toBe("u1");
    expect(payload.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(row.customer_id).toBe("999");
  });
});
