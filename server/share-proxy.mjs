// Pure share-link resolution. No Express, no env reads — everything is injected
// so it unit-tests without a network or database.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v) => typeof v === "string" && ISO.test(v);
const iso = (d) => d.toISOString().slice(0, 10);

function windowFrom(start, end) {
  if (isIso(start) && isIso(end)) return { start, end };
  const today = new Date();
  return { start: iso(new Date(today.getTime() - 14 * 864e5)), end: iso(today) };
}

/**
 * Resolve a public share token to that one client's live CreativeOS data.
 *
 * @param {{token:string,start?:string,end?:string}} params
 * @param {{supabase:any,fetchImpl:typeof fetch,webhookKey:string,n8nUrl:string}} deps
 * @returns {Promise<{status:number, body?:unknown}>}
 */
export async function resolveShareData({ token, start, end }, deps) {
  const { supabase, fetchImpl, webhookKey, n8nUrl } = deps;

  const { data: row, error } = await supabase
    .from("client_share_links")
    .select("customer_id, client_name, revoked")
    .eq("token", token)
    .maybeSingle();

  if (error) return { status: 500 };
  if (!row) return { status: 404 };
  if (row.revoked) return { status: 403 };

  const w = windowFrom(start, end);
  const u = new URL(n8nUrl);
  u.searchParams.set("scope", "client");
  u.searchParams.set("customerId", row.customer_id);
  u.searchParams.set("start", w.start);
  u.searchParams.set("end", w.end);

  const res = await fetchImpl(u, { headers: { Authorization: `Bearer ${webhookKey}` } });
  if (!res.ok) return { status: 502 };

  const body = await res.json();
  // The client-scope payload returns account.name = the raw customer id. Replace it
  // with the friendly name captured when the share link was created.
  if (body && body.account && row.client_name) body.account.name = row.client_name;
  return { status: 200, body };
}
