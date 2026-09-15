const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULTS_PATH = path.join(process.cwd(), 'data.json');
// Fallback used only when Supabase isn't configured yet. /tmp is ephemeral
// on Vercel (can reset on redeploys / new instances) — set up Supabase
// (see README) for durable settings.
const RUNTIME_PATH = '/tmp/void-sim-data.json';
const TABLE = 'app_settings';
const ROW_ID = 'site';

function readDefaults() {
  return JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'));
}

let supabaseClient;
function getSupabase() {
  if (supabaseClient !== undefined) return supabaseClient;

  // The Vercel <-> Supabase integration can name these a couple of
  // different ways depending on how it was connected — check the common
  // variants.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    supabaseClient = null;
    return supabaseClient;
  }
  supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

async function readSettings() {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from(TABLE).select('data').eq('id', ROW_ID).maybeSingle();
      if (!error && data && data.data) return data.data;
    } catch (e) {
      // fall through to defaults
    }
    return readDefaults();
  }

  try {
    if (fs.existsSync(RUNTIME_PATH)) {
      return JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
    }
  } catch (e) {
    // fall through
  }
  return readDefaults();
}

async function writeSettings(data) {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from(TABLE)
      .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return;
  }
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json(await readSettings());
    return;
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const password = req.headers['x-admin-password'];
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
      res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });
      return;
    }
    if (!password || password !== expected) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
      }
    }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Missing settings body' });
      return;
    }

    try {
      await writeSettings(body);
      res.status(200).json({ ok: true, settings: body });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save settings: ' + e.message });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  res.status(405).json({ error: 'Method not allowed' });
};
