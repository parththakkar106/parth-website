# parth.party

Parth Thakkar's personal site. It opens as a terminal styled after Claude Code, where visitors run slash commands
or ask questions that an LLM answers from Parth's resume and project notes. A **Plain** switch (top right, or `/plain`,
or `?view=plain`) shows a normal portfolio page in resume order.

Plain HTML, CSS and JavaScript with no build step, plus one Cloudflare Pages Function for the chat.

## Layout

```
public/                     the site (Cloudflare Pages serves this folder)
  index.html                both views; terminal and plain share one page
  assets/css/site.css       tokens at the top (:root), terminal styles, then plain-view styles
  assets/js/site.js         commands, chat, contributions heatmap, view switch
  assets/Parth_Thakkar_Resume.pdf
  data/contributions.json   GitHub contribution calendar, refreshed nightly
functions/api/chat.js       POST /api/chat streams the model's answer; GET reports whether it is live
functions/api/_knowledge.js the only facts the model may use, plus its rules
functions/api/football.js   GET /api/football: Barça's and Messi's (Inter Miami, Argentina) last and next matches from ESPN, edge-cached 10 min (1 min while live)
scripts/fetch-contributions.mjs
.github/workflows/contributions.yml
```

## Chat: demo mode and going live

Until an OpenRouter key and model are configured, `/api/chat` returns 503 and the terminal plays scripted answers
marked **DEMO**. To go live, in Cloudflare: **Workers & Pages → parth-website → Settings → Variables and secrets**:

| Name | Type | Value |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Secret | your OpenRouter key |
| `OPENROUTER_MODEL` | Text | a model id, e.g. one of OpenRouter's `:free` models |

Redeploy, and the status line changes from DEMO to "model: live via OpenRouter". The key never reaches the browser.

Guardrails in the function: same-site `Origin` check, last 8 turns only, 1,000 characters per message, 450 output
tokens. Also add a Cloudflare **rate limiting rule** for `/api/chat` (Security → WAF → Rate limiting rules, e.g.
10 requests per minute per IP) so nobody can drain the free quota.

When the resume or projects change, update `functions/api/_knowledge.js` along with the page.

## Changing CSS or JS

Cloudflare lets browsers keep files under `assets/` for up to 4 hours, so `index.html` loads them with a
content hash (`site.js?v=…`). After editing `site.css` or `site.js`, run `node scripts/stamp-assets.mjs` and commit
the updated `index.html`, or visitors may keep the old version for a few hours.

## Contributions heatmap

`public/data/contributions.json` currently holds **sample data** (`"sample": true`), so the page says so.
The nightly workflow replaces it with the real calendar from GitHub, including private contributions (the profile has
"Include private contributions" on). Run it once by hand from the Actions tab after the first push. If the default
token is refused, add a `CONTRIB_TOKEN` repository secret (a fine-grained token with read access to your profile).

## Deploy on Cloudflare Pages

1. Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Framework preset: None. Build command: empty. Build output directory: `public`.
3. Custom domains → add `parth.party` (and `www.parth.party`). DNS is already on Cloudflare, so the records are created for you.

Every push to `main` redeploys, including the nightly contributions commit.

## Run locally

```bash
python3 -m http.server -d public 8000          # static only: chat runs in DEMO mode
npx wrangler pages dev                         # with the chat function; put keys in .dev.vars
```
