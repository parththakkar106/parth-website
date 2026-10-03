// GET /api/barca -> FC Barcelona's latest results and next fixtures, all competitions.
// Source: ESPN's public schedule feed (no key). Responses are cached at the edge so a busy
// page makes at most one upstream call every few minutes.
const TEAM = '83'; // ESPN's id for FC Barcelona
const FEED = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${TEAM}/schedule`;
const SHOWN = 3;
const SHORT = { 'UEFA Champions League': 'UCL', 'Spanish Copa del Rey': 'Copa', 'Spanish Supercopa': 'Supercopa', 'Club Friendly': 'Friendly' };

function side(c) {
  const score = c.score && typeof c.score === 'object' ? c.score : { displayValue: c.score };
  return {
    id: c.team.id,
    name: c.team.shortDisplayName || c.team.displayName,
    abbr: c.team.abbreviation,
    score: score.displayValue ?? null,
    pens: score.shootoutScore ?? c.shootoutScore ?? null,
    winner: Boolean(c.winner)
  };
}

function match(e) {
  const c = e.competitions[0], st = c.status.type;
  const sides = c.competitors.map(side);
  const home = c.competitors.findIndex(x => x.homeAway === 'home');
  const h = sides[home], a = sides[1 - home];
  const us = h.id === TEAM ? h : a, them = us === h ? a : h;
  const league = e.league?.name || e.league?.shortName || '';
  return {
    id: e.id,
    date: e.date,
    comp: SHORT[league] || e.league?.shortName || league,
    state: st.state, // pre | in | post
    detail: st.shortDetail,
    home: h, away: a,
    atHome: us === h,
    opponent: them.name,
    result: st.state !== 'post' ? null : us.winner ? 'W' : them.winner ? 'L' : 'D',
    venue: c.venue?.fullName || null,
    link: e.links?.find(l => l.rel?.includes('summary'))?.href || null
  };
}

async function build() {
  const [past, next] = await Promise.all([FEED, FEED + '?fixture=true'].map(u =>
    fetch(u, { headers: { Accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); })));
  const byId = new Map();
  for (const e of [...(past.events || []), ...(next.events || [])]) byId.set(e.id, match(e));
  const all = [...byId.values()].sort((x, y) => x.date.localeCompare(y.date));
  return {
    team: { name: 'FC Barcelona', record: past.team?.recordSummary || null, standing: past.team?.standingSummary || null },
    live: all.find(m => m.state === 'in') || null,
    recent: all.filter(m => m.state === 'post').slice(-SHOWN).reverse(),
    upcoming: all.filter(m => m.state === 'pre').slice(0, SHOWN),
    updated: new Date().toISOString()
  };
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default, key = new Request(new URL('/api/barca', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let data;
  try { data = await build(); } catch { return Response.json({ error: 'unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
  // Refresh every minute during a match, otherwise every 10.
  const res = Response.json(data, { headers: { 'Cache-Control': `public, max-age=${data.live ? 60 : 600}` } });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
