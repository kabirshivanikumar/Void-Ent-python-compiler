# VOID // Enterprises — Python Simulator

In-browser Python (Pyodide/WASM) sandbox with a server-proxied OpenRouter
"AI Code Generator" and a password-protected admin panel for toggling
sponsored content and models.

## Structure

```
index.html            main app (static)
admin/index.html       admin dashboard (static, password gated)
api/generate.js         proxies AI generation requests to OpenRouter
api/settings.js         GET (public) / POST (admin-only) site settings
api/admin-login.js      checks the admin password
data.json                default settings shipped with the deploy
vercel.json              routes /admin to admin/index.html
```

## Deploy (Vercel)

1. Push this folder to a GitHub repo and import it in Vercel, or run
   `vercel` from inside this folder with the Vercel CLI.
2. In Project Settings → Environment Variables, add:
   - `OPENROUTER_API_KEY` — your OpenRouter key (never exposed to the browser)
   - `ADMIN_PASSWORD` — the password you'll use to sign into `/admin`
3. Deploy. The app is served at `/`, and the admin panel at `/admin`.

## Notes on settings persistence

`/api/settings` currently reads defaults from `data.json` and writes admin
edits to `/tmp` on the serverless instance. That's enough to demo and use
day-to-day, but **`/tmp` is ephemeral on Vercel** — it can reset on
redeploys or when your function scales to a fresh instance, so edits aren't
guaranteed to be permanent. When you're ready for durable settings, swap
`api/settings.js`'s read/write functions for a real store — Vercel KV,
Vercel Edge Config, or any small database — the rest of the app doesn't
need to change.

## Local development

```
npm i -g vercel
vercel dev
```

Create a `.env` file (see `.env.example`) with `OPENROUTER_API_KEY` and
`ADMIN_PASSWORD` before running locally.
