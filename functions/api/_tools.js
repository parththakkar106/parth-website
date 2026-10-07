// Tools the chat model can draw on. Free models call tools unreliably, so instead of native tool calls the server
// looks at the recent questions, runs the tools they need, and puts the output in the model's context.
// Each tool returns { name, text }; chat.js sends the names to the page (X-Tools) so it can show what ran.
import { footballData } from './football.js';

const GH_USER = 'parththakkar106';

// Questions that trigger each tool (checked against the visitor's last few messages).
const FOOTBALL = /\b(bar[cç]a|barcelona|messi|football|soccer|match(es)?|games?|fixtures?|scores?|results?|team|league|la ?liga|table|standings?|inter miami|argentina|play(ed|ing|s)?|won|lost|wins?|los(e|ing)|beat|next one|latest)\b|\/(latest|barca|messi)\b/i;
const TABLE = /\b(table|standings?|position|place|rank(ed|ing)?|top of|points?|leading|top|first|second|third|la ?liga|league)\b/i;
const GITHUB = /\b(github|commits?|push(ed|ing)?|repos?|repositor(y|ies)|working on|work(ing)? on|lately|recent(ly)?|right now|these days|this week|currently|latest (project|work)|been (up to|doing|building|coding)|coding|activity|active)\b/i;
// Public repos the model can read the README of; anything else is matched by its repo name.
const REPO_ALIASES = {
  'AI-DnD': /\b(d&d|dnd|dungeons?|ai[- ]?dnd|referee|storytell\w*|scenario|world[- ]state|memory bank)\b/i,
  'portfolio-website-parth': /\b(this (site|website|page|terminal|portfolio)|the (site|website)|parth\.party|portfolio|website|built (this|the site))\b/i,
};
const DEEP = /\b(how|why|design|architecture|works?|internals?|built|engine|referee|memory|context|budget\w*|prompt\w*|tests?|stack|tech)\b/i;

export const zoneOk = tz => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
const when = (iso, tz) => new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = (iso, tz) => new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' });

// fetch() with an edge cache: answers from the cached copy (kept a day) and refreshes it in the background once it
// is older than `ttl` seconds, so chat answers rarely wait on GitHub or ESPN, and their rate limits stay far away.
async function cached(ctx, url, ttl, headers = {}) {
  const cache = caches.default;
  const key = new Request(new URL('/__tool-cache/' + encodeURIComponent(url), ctx.request.url).toString());
  const load = async () => {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const body = await r.text();
    await cache.put(key, new Response(body, { headers: { 'Cache-Control': 'public, max-age=86400', 'X-Fetched': String(Date.now()) } }));
    return body;
  };
  const hit = await cache.match(key);
  if (hit) {
    if (Date.now() - Number(hit.headers.get('X-Fetched') || 0) > ttl * 1000) ctx.waitUntil(load().catch(() => {}));
    return hit.text();
  }
  return load();
}
const cachedJson = async (...a) => JSON.parse(await cached(...a));

/* ---------- football: /latest, plus the La Liga table and live goals ---------- */

const score = m => { const us = m.atHome ? m.home : m.away, them = m.atHome ? m.away : m.home; return `${us.score}-${them.score}` + (us.pens != null && them.pens != null ? ` (${us.pens}-${them.pens} on penalties)` : ''); };
const vs = (m, named) => (named ? m.team + ' ' : '') + (m.atHome ? 'vs ' : 'at ') + m.opponent;

// /latest as plain lines for the model, e.g. "  W 3-1 at Sevilla (LALIGA, Sat, Sep 19, 3:00 PM)".
function footballText(d, tz) {
  const lines = (f, named) => {
    if (!f) return ['  feed unavailable'];
    const recent = f.recent || (f.last ? [f.last] : []), upcoming = f.upcoming || (f.next ? [f.next] : []);
    return [
      f.live && `  LIVE NOW: ${score(f.live)} ${vs(f.live, named)} (${f.live.comp}, ${f.live.detail || 'in progress'})`,
      recent.length && '  recent results, oldest first:', ...recent.map(m => `    ${m.result} ${score(m)} ${vs(m, named)} (${m.comp}, ${when(m.date, tz)})`),
      upcoming.length && '  next matches:', ...upcoming.map(m => `    ${vs(m, named)} (${m.comp}, ${when(m.date, tz)})`),
    ].filter(Boolean);
  };
  return [
    `Output of /latest (live from ESPN, fetched ${when(d.updated, tz)}; times in the visitor's timezone, ${tz}; now is ${when(new Date().toISOString(), tz)}):`,
    'FC Barcelona' + (d.barca?.standing ? ` (${d.barca.standing})` : '') + ':', ...lines(d.barca),
    "Messi's teams (Inter Miami, Argentina):", ...lines(d.messi, true),
  ].join('\n');
}

async function laLigaTable(ctx) {
  const d = await cachedJson(ctx, 'https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings', 3600);
  const rows = (d.children?.[0]?.standings?.entries || []).map(e => {
    const s = Object.fromEntries((e.stats || []).map(x => [x.name, x.displayValue]));
    return { rank: Number(s.rank), line: `${s.rank}. ${e.team.displayName}: ${s.points} pts, played ${s.gamesPlayed}, W-D-L ${s.wins}-${s.ties}-${s.losses}, goal difference ${s.pointDifferential}` };
  }).sort((a, b) => a.rank - b.rank);
  if (!rows.length) throw new Error('no standings');
  return 'La Liga table (ESPN, updated hourly):\n' + rows.map(r => '  ' + r.line).join('\n');
}

async function liveEvents(ctx, m) {
  const d = await cachedJson(ctx, 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=' + encodeURIComponent(m.id), 60);
  const ev = (d.keyEvents || []).filter(e => /goal|red card|penalty/i.test(e.type?.text || '') && e.shortText);
  return `Key moments so far in ${m.home.name} vs ${m.away.name} (${m.detail || 'live'}):\n` +
    (ev.length ? ev.map(e => `  ${e.clock?.displayValue || ''} ${e.shortText}${e.team?.displayName ? ' (' + e.team.displayName + ')' : ''}`).join('\n') : '  no goals or red cards yet');
}

/* ---------- GitHub: recent public activity and project READMEs ---------- */

const ghHeaders = env => ({
  'User-Agent': 'parth.party', Accept: 'application/vnd.github+json',
  ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
});
// Public, non-fork repos, most recently pushed first. GitHub only lists public repos here.
const publicRepos = async ctx => (await cachedJson(ctx, `https://api.github.com/users/${GH_USER}/repos?sort=pushed&per_page=30`, 1800, ghHeaders(ctx.env)))
  .filter(r => !r.private && !r.fork && !r.archived);

async function githubActivity(ctx, tz) {
  const repos = (await publicRepos(ctx)).slice(0, 3);
  const commits = await Promise.all(repos.map(r =>
    cachedJson(ctx, `https://api.github.com/repos/${GH_USER}/${r.name}/commits?per_page=4`, 1800, ghHeaders(ctx.env)).catch(() => [])));
  return `Parth's recent public GitHub activity (github.com/${GH_USER}, most recently pushed repos first; private work isn't listed):\n` +
    repos.map((r, i) => `- ${r.name}${r.description ? ': ' + r.description : ''} (last push ${day(r.pushed_at, tz)})\n` +
      commits[i].map(c => `    "${String(c.commit?.message || '').split('\n')[0].slice(0, 110)}" (${day(c.commit?.author?.date, tz)})`).join('\n')).join('\n');
}

// Keeps the sections of a Markdown file that best match the question, up to `max` characters.
function bestSections(md, question, max) {
  const words = [...new Set(question.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [])].filter(w => !STOP.has(w));
  const parts = md.replace(/!?\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*/g, '').replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, '').split(/\n(?=#{1,3} )/);
  const scored = parts.map((p, i) => {
    const head = (p.match(/^#+ .*/) || [''])[0].toLowerCase(), body = p.toLowerCase();
    return { i, p, s: (i === 0 ? 2 : 0) + words.reduce((n, w) => n + (head.includes(w) ? 3 : 0) + Math.min(body.split(w).length - 1, 3), 0) };
  });
  let left = max;
  const keep = scored.filter(x => x.s > 0).sort((a, b) => b.s - a.s).filter(x => (left -= Math.min(x.p.length, 2500)) >= 0);
  return keep.sort((a, b) => a.i - b.i).map(x => x.p.slice(0, 2500)).join('\n\n');
}
const STOP = new Set('what does that this with from have about tell more your they them their then than there when which while would could should into does doing done parth parth\'s work works how\'s'.split(' '));

async function readRepo(ctx, repo, question) {
  const raw = path => cached(ctx, `https://raw.githubusercontent.com/${GH_USER}/${repo}/HEAD/${path}`, 3600);
  const out = [`${repo}/README.md:\n` + bestSections(await raw('README.md'), question, 6000)];
  // AI D&D keeps its design notes in docs/GUIDE.md; pull the sections that match "how/why" questions.
  if (repo === 'AI-DnD' && DEEP.test(question)) {
    const guide = await raw('docs/GUIDE.md').catch(() => '');
    const best = guide && bestSections(guide, question, 5000);
    if (best) out.push(`${repo}/docs/GUIDE.md (design notes, best-matching sections):\n` + best);
  }
  return out.join('\n\n');
}

// Which public repo the question is about: a known alias, or a repo whose name appears in it.
async function repoFor(ctx, question) {
  const alias = Object.keys(REPO_ALIASES).find(r => REPO_ALIASES[r].test(question));
  if (alias) return alias;
  const q = question.toLowerCase().replace(/[-_]/g, ' ');
  const repos = await publicRepos(ctx).catch(() => []);
  return repos.map(r => r.name).find(n => n.length > 3 && q.includes(n.toLowerCase().replace(/[-_]/g, ' '))) || null;
}

/* ---------- picking the tools ---------- */

export async function runTools({ messages, tz, request, env, waitUntil }) {
  const ctx = { request, env, waitUntil };
  const users = messages.filter(m => m.role === 'user').map(m => m.content);
  const latest = users[users.length - 1] || '', recent = users.slice(-3).join('\n'), lastTwo = users.slice(-2).join('\n');
  const jobs = [];
  const add = (name, fn, fail) => jobs.push(fn().then(text => ({ name, text }), e => { console.log('tool failed', name, String(e)); return fail ? { name, text: fail } : null; }));

  if (FOOTBALL.test(recent)) {
    const football = footballData(request, waitUntil).then(r => r.data);
    add('latest', async () => footballText(await football, tz), 'Output of /latest: the match feed is unavailable right now.');
    if (TABLE.test(lastTwo)) add('table', () => laLigaTable(ctx));
    const d = await football.catch(() => null);
    for (const m of [d?.barca?.live, d?.messi?.live].filter(Boolean)) add('live', () => liveEvents(ctx, m));
  }
  if (GITHUB.test(latest)) add('github', () => githubActivity(ctx, tz));
  const repo = await repoFor(ctx, lastTwo);
  if (repo) add('readme:' + repo, () => readRepo(ctx, repo, latest));

  return (await Promise.all(jobs)).filter(Boolean);
}
