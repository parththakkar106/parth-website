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
    full: (c.team.displayName || '').replace(/ (CF|FC)$/, ''),
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
    team: us.full || us.name,
    opponent: them.name,
    result: st.state !== 'post' ? null : us.winner ? 'W' : them.winner ? 'L' : 'D',
    venue: c.venue?.fullName || null,
    link: e.links?.find(l => l.rel?.includes('summary'))?.href || null
  };
}

const get = u => fetch(u, { headers: { Accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });

// Merges results and fixtures for one or more teams into { standing, live, last, next }, plus the last
// and next few matches (recent, upcoming) for the chat model.
async function follow(ids) {
  const feeds = await Promise.all(ids.flatMap(id => [get(FEED(id)), get(FEED(id) + '?fixture=true')]));
  const byId = new Map();
  for (const f of feeds) for (const e of f.events || []) byId.set(e.id, match(e, ids));
  const all = [...byId.values()].sort((x, y) => x.date.localeCompare(y.date));
  return {
    standing: feeds[0].team?.standingSummary || null,
    live: all.find(m => m.state === 'in') || null,
    last: all.filter(m => m.state === 'post').pop() || null,
    next: all.find(m => m.state === 'pre') || null,
    recent: all.filter(m => m.state === 'post').slice(-3),
    upcoming: all.filter(m => m.state === 'pre').slice(0, 3)
  };
}

async function build() {
  // Messi's feed failing shouldn't take Barça down with it.
  const [barca, messi] = await Promise.all([follow(BARCA), follow(MESSI).catch(() => null)]);
  return { barca, messi, updated: new Date().toISOString() };
}

// Stale-while-revalidate: the edge keeps the last good copy for a day and always answers from it
// straight away. Once it is older than 10 minutes (1 while a match is live) the next request also
// refreshes it in the background, so visitors never wait on ESPN unless this edge has no copy at all.
const KEEP = 86400;
const fresh = data => ((data.barca?.live || data.messi?.live) ? 60 : 600) * 1000;
const send = (body, cache) => new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });

async function refresh(cache, key) {
  const data = await build();
  const body = JSON.stringify(data);
  await cache.put(key, send(body, `public, max-age=${KEEP}`));
  return { data, body };
}

// The current data, from this edge's cache when it has a copy. Also used by chat.js, so the chat model sees
// the same matches as /latest.
export async function footballData(request, waitUntil) {
  const cache = caches.default, key = new Request(new URL('/api/football', request.url).toString());
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.text();
    let data = null;
    try { data = JSON.parse(body); } catch {}
    if (data && Date.now() - Date.parse(data.updated) > fresh(data)) waitUntil(refresh(cache, key).catch(() => {}));
    if (data) return { data, body };
  }
  return refresh(cache, key);
}

export async function onRequestGet({ request, waitUntil }) {
  try {
    const { body } = await footballData(request, waitUntil);
    return send(body, 'public, max-age=60');
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
