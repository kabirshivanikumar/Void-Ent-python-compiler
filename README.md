# VOID // Enterprises — Python Simulator

In-browser Python (Pyodide/WASM) sandbox with a server-proxied OpenRouter
"AI Assistant" (follow-up edits included), a password-protected admin panel
for site settings backed by a free database, and a "Save as Image" button
that screenshots just the editor + console.

## Structure

```
index.html            main app (static)
admin/index.html       admin dashboard (static, password gated)
api/generate.js         proxies AI generation/follow-up requests to OpenRouter
api/settings.js         GET (public) / POST (admin-only) site settings — Vercel KV
api/admin-login.js      checks the admin password
data.json                default settings shipped with the deploy
vercel.json              routes /admin to admin/index.html
package.json             declares the @vercel/kv dependency
```

## Deploy (Vercel)

1. Push this folder to a GitHub repo and import it in Vercel, or run
   `vercel` from inside this folder with the Vercel CLI.
2. **Add a database (free, ~2 minutes):** in your Vercel project →
   Storage → Create Database → **KV** (Upstash Redis under the hood).
   Connect it to this project. Vercel automatically adds the
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` env vars for you — no manual
   setup needed. This is what makes admin settings persist properly
   (see "Notes on settings persistence" below).
3. In Project Settings → Environment Variables, also add:
   - `OPENROUTER_API_KEY` — your OpenRouter key (never exposed to the browser)
   - `ADMIN_PASSWORD` — the password you'll use to sign into `/admin`
4. Deploy. The app is served at `/`, and the admin panel at `/admin`.

## Notes on settings persistence

`api/settings.js` stores settings in **Vercel KV** when it's connected
(recommended — durable, free tier is generous, zero-config once you attach
the database in step 2 above). If KV isn't connected yet, it falls back to
writing to `/tmp` on the serverless instance so the app still works, but
`/tmp` is ephemeral and can reset on redeploys or new instances — attach KV
before relying on saved settings.

## Model

The model is hard-coded server-side in `api/generate.js`
(`meta-llama/llama-3.1-8b-instruct`) — there's no model picker in the UI
and any `model` field a client sends is ignored. To change it, edit the
`FIXED_MODEL` constant in `api/generate.js`.

## AI Assistant follow-ups

The AI panel keeps a small rolling context window (last 6 exchanges) so you
can ask for changes to code it just generated — e.g. "now add error
handling" — without re-describing everything. The current editor contents
are also sent along so the model edits what's actually there. Context is
capped both client-side and defensively server-side (`api/generate.js`),
and "new chat ✕" clears it.

## Save as Image

The camera button in the toolbar screenshots only the Editor + Console
panels (not the sidebar, AI panel, or sponsor cards) using `html2canvas`
and downloads it as a PNG. Note: it captures what's currently rendered, so
console output that's scrolled out of view won't be included.

## Local development

```
npm i
npm i -g vercel
vercel dev
```

Create a `.env` file (see `.env.example`) with `OPENROUTER_API_KEY` and
`ADMIN_PASSWORD` before running locally. For local KV, `vercel env pull`
after attaching a KV database will pull the KV env vars down too.
