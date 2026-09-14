const fs = require('fs');
const path = require('path');

// Bundled defaults (read-only, shipped with the deployment).
const DEFAULTS_PATH = path.join(process.cwd(), 'data.json');
// Runtime overrides written by the admin panel. NOTE: /tmp is ephemeral on
// Vercel — it can vanish on redeploys or when a new serverless instance is
// spun up. This is fine to ship "for now", but for durable settings that
// survive redeploys/cold starts, swap this for Vercel KV / Edge Config /
// a real database.
const RUNTIME_PATH = '/tmp/void-sim-data.json';

function readSettings() {
  try {
    if (fs.existsSync(RUNTIME_PATH)) {
      return JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
    }
  } catch (e) {
    // fall through to defaults
  }
  return JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8'));
}

function writeSettings(data) {
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json(readSettings());
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
      writeSettings(body);
      res.status(200).json({ ok: true, settings: body });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save settings: ' + e.message });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  res.status(405).json({ error: 'Method not allowed' });
};
