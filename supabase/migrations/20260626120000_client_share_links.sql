-- client_share_links: one reusable, revocable public link per client.
-- The public share page never reads this table; the server proxy reads it with
-- the service-role key (which bypasses RLS). These policies only govern the
-- authenticated @ad-lab.io users who manage links from the dashboard.
CREATE TABLE public.client_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX client_share_links_token_idx ON public.client_share_links (token);

ALTER TABLE public.client_share_links ENABLE ROW LEVEL SECURITY;

-- Only authenticated @ad-lab.io users may read/manage links.
CREATE POLICY "ad-lab users read share links"
ON public.client_share_links FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') LIKE '%@ad-lab.io');

CREATE POLICY "ad-lab users insert share links"
ON public.client_share_links FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') LIKE '%@ad-lab.io');

CREATE POLICY "ad-lab users update share links"
ON public.client_share_links FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') LIKE '%@ad-lab.io')
WITH CHECK ((auth.jwt() ->> 'email') LIKE '%@ad-lab.io');
