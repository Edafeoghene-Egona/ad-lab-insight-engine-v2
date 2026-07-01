import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { resolveShareData } from './server/share-proxy.mjs';
import { resolveTranscript } from './server/transcript.mjs';
import { getSubtitles } from './server/youtube-captions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const WEBHOOK_KEY = process.env.WEBHOOK_KEY || '';
const N8N_URL = process.env.CREATIVEOS_WEBHOOK_URL || 'https://ad-lab.app.n8n.cloud/webhook/creativeos';

// Service-role client: bypasses RLS so the proxy can validate share tokens.
// These env vars are server-only and never reach the browser bundle.
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

// Public, scoped client share-link data proxy. Holds the webhook secret
// server-side; a token can only ever resolve to its bound customer_id.
app.get('/api/share/:token', async (req, res) => {
    try {
        const result = await resolveShareData(
            { token: req.params.token, start: req.query.start, end: req.query.end },
            { supabase: supabaseAdmin, fetchImpl: fetch, webhookKey: WEBHOOK_KEY, n8nUrl: N8N_URL },
        );
        if (result.status !== 200) return res.sendStatus(result.status);
        res.json(result.body);
    } catch (err) {
        console.error('share proxy error', err);
        res.sendStatus(500);
    }
});

// Public transcript proxy: scrapes + caches a video's YouTube captions.
// Returns a JSON body on every status (unlike /api/share, which uses sendStatus).
app.get('/api/transcript/:videoId', async (req, res) => {
    try {
        const result = await resolveTranscript(
            { videoId: req.params.videoId },
            { supabase: supabaseAdmin, getSubtitles },
        );
        res.status(result.status).json(result.body);
    } catch (err) {
        console.error('transcript error', err);
        res.status(500).json({ error: 'internal error' });
    }
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// SPA catch-all: serve index.html for any unmatched route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
