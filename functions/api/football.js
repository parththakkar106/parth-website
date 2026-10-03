// GET /api/football -> last result, next match and any live match for Barça, and for Messi's teams.
// Source: ESPN's public schedule feed (no key), all competitions. Responses are cached at the edge
// so a busy page makes at most a few upstream calls every 10 minutes.
const FEED = id => `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${id}/schedule`;
const BARCA = ['83'], MESSI = ['20232', '202']; // ESPN ids: FC Barcelona; Inter Miami, Argentina
const SHORT = {
  'UEFA Champions League': 'UCL', 'Spanish Copa del Rey': 'Copa', 'Spanish Supercopa': 'Supercopa', 'Club Friendly': 'Friendly',
  'International Friendly': 'Friendly', 'FIFA World Cup': 'World Cup', 'FIFA World Cup Qualifying - CONMEBOL': 'WC qualifier',
  'Copa América': 'Copa América', 'Major League Soccer': 'MLS', 'Leagues Cup': 'Leagues Cup', 'CONCACAF Champions Cup': 'CCC'
};

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

function match(e, ids) {
  const c = e.competitions[0], st = c.status.type;
  const sides = c.competitors.map(side);
  const home = c.competitors.findIndex(x => x.homeAway === 'home');
  const h = sides[home], a = sides[1 - home];
  const us = ids.includes(h.id) ? h : a, them = us === h ? a : h;
  const league = e.league?.name || e.league?.shortName || '';
  return {
    id: e.id,
    date: e.date,
    comp: SHORT[league] || e.league?.shortName || league,
    state: st.state, // pre | in | post
    detail: st.shortDetail,
    home: h, away: a,
    atHome: us === h,
    team: us.name,
    opponent: them.name,
    result: st.state !== 'post' ? null : us.winner ? 'W' : them.winner ? 'L' : 'D',
    venue: c.venue?.fullName || null,
    link: e.links?.find(l => l.rel?.includes('summary'))?.href || null
  };
}

const get = u => fetch(u, { headers: { Accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });

// Merges results and fixtures for one or more teams into { standing, live, last, next }.
async function follow(ids) {
  const feeds = await Promise.all(ids.flatMap(id => [get(FEED(id)), get(FEED(id) + '?fixture=true')]));
  const byId = new Map();
  for (const f of feeds) for (const e of f.events || []) byId.set(e.id, match(e, ids));
  const all = [...byId.values()].sort((x, y) => x.date.localeCompare(y.date));
  return {
    standing: feeds[0].team?.standingSummary || null,
    live: all.find(m => m.state === 'in') || null,
    last: all.filter(m => m.state === 'post').pop() || null,
    next: all.find(m => m.state === 'pre') || null
  };
}

async function build() {
  // Messi's feed failing shouldn't take Barça down with it.
  const [barca, messi] = await Promise.all([follow(BARCA), follow(MESSI).catch(() => null)]);
  return { barca, messi, updated: new Date().toISOString() };
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default, key = new Request(new URL('/api/football', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let data;
  try { data = await build(); } catch { return Response.json({ error: 'unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
  // Refresh every minute during a match, otherwise every 10.
  const live = data.barca.live || data.messi?.live;
  const res = Response.json(data, { headers: { 'Cache-Control': `public, max-age=${live ? 60 : 600}` } });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
