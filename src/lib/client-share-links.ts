import { supabase as defaultSupabase } from "@/integrations/supabase/client";

export interface ShareLinkRow {
  id: string;
  customer_id: string;
  client_name: string;
  token: string;
  revoked: boolean;
}

/** 32 random bytes, base64url — an unguessable URL secret. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function shareUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/c/${token}`;
}

const COLS = "id, customer_id, client_name, token, revoked";

type Deps = { supabase?: any; userId: string };

export async function getShareLink(
  customerId: string,
  supabase: any = defaultSupabase,
): Promise<ShareLinkRow | null> {
  const { data, error } = await supabase
    .from("client_share_links")
    .select(COLS)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createShareLink(
  args: { customerId: string; clientName: string },
  deps: Deps,
): Promise<ShareLinkRow> {
  const supabase = deps.supabase ?? defaultSupabase;
  const payload = {
    customer_id: args.customerId,
    client_name: args.clientName,
    token: generateShareToken(),
    created_by: deps.userId,
  };
  const { data, error } = await supabase
    .from("client_share_links")
    .insert(payload)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function getOrCreateShareLink(
  args: { customerId: string; clientName: string },
  deps: Deps,
): Promise<ShareLinkRow> {
  const existing = await getShareLink(args.customerId, deps.supabase);
  return existing ?? createShareLink(args, deps);
}

export async function setRevoked(
  customerId: string,
  revoked: boolean,
  supabase: any = defaultSupabase,
): Promise<void> {
  const { error } = await supabase
    .from("client_share_links")
    .update({ revoked })
    .eq("customer_id", customerId);
  if (error) throw error;
}

export async function regenerateShareLink(
  customerId: string,
  supabase: any = defaultSupabase,
): Promise<ShareLinkRow> {
  const { data, error } = await supabase
    .from("client_share_links")
    .update({ token: generateShareToken(), revoked: false })
    .eq("customer_id", customerId)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}
