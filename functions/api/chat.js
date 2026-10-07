// POST /api/chat  -> streams the model's answer as text/plain; X-Tools names the site commands it ran (e.g. "latest").
// GET  /api/chat  -> { live: boolean } so the page can show whether answers are live or scripted.
//
// Configure in Cloudflare Pages > Settings > Variables and secrets:
//   OPENROUTER_API_KEY  (secret)  your OpenRouter key
//   OPENROUTER_MODEL    (text)    model id, e.g. one of OpenRouter's ":free" models
//   OPENROUTER_FALLBACK_MODELS (text, optional) comma-separated models OpenRouter tries when the main one is busy
// and a KV namespace bound as NOTES whose key "parth" holds the Markdown notes about Parth (kept out of GitHub).
// Until all of these are set, POST returns 503 and the page falls back to scripted demo answers.
import { systemPrompt } from './_knowledge.js';
import { footballData } from './football.js';

const MAX_TURNS = 12;
const MAX_CHARS = 1000;
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?parth\.party$/, /^https:\/\/([a-z0-9-]+\.)?parth-(party|website)(-[a-z0-9]+)?\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

// OpenRouter tries these in order when a model is rate-limited or down (it accepts up to 3).
const modelList = env => [env.OPENROUTER_MODEL, ...String(env.OPENROUTER_FALLBACK_MODELS || '').split(',')].map(m => m.trim()).filter(Boolean).slice(0, 3);

const isLive = env => Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL && env.NOTES);

// The notes in KV start with a title and an editor's preamble; the model only needs the sections.
const loadNotes = async env => {
  const md = await env.NOTES.get('parth', { cacheTtl: 300 });
  return md && md.replace(/^(# .+\n)[\s\S]*?(?=\n## )/, '$1').trim();
};

// Site commands the model can draw on. Free models call tools unreliably, so the server runs a command itself
// when the recent questions are about it and hands the output to the model, and tells the page via X-Tools.
const FOOTBALL = /\b(bar[cç]a|barcelona|messi|football|soccer|match(es)?|games?|fixtures?|scores?|results?|team|league|la ?liga|inter miami|argentina|play(ed|ing|s)?|won|lost|wins?|los(e|ing)|beat|next one|latest)\b|\/(latest|barca|messi)\b/i;

const zoneOk = tz => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
const when = (iso, tz) => new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// /latest as plain lines for the model, e.g. "last: W 3-1 at Sevilla (LALIGA, Sun, Sep 20, 9:00 PM)".
function footballText(d, tz) {
  const score = m => { const us = m.atHome ? m.home : m.away, them = m.atHome ? m.away : m.home; return `${us.score}-${them.score}` + (us.pens != null && them.pens != null ? ` (${us.pens}-${them.pens} on penalties)` : ''); };
  const vs = (m, named) => (named ? m.team + ' ' : '') + (m.atHome ? 'vs ' : 'at ') + m.opponent;
  const lines = (f, named) => !f ? ['  feed unavailable'] : [
    f.live && `  live now: ${score(f.live)} ${vs(f.live, named)} (${f.live.comp}, ${f.live.detail || 'in progress'})`,
    f.last && `  last: ${f.last.result} ${score(f.last)} ${vs(f.last, named)} (${f.last.comp}, ${when(f.last.date, tz)})`,
    f.next && !f.live && `  next: ${vs(f.next, named)} (${f.next.comp}, ${when(f.next.date, tz)})`,
  ].filter(Boolean);
  return [
    `Output of /latest (live from ESPN, fetched ${when(d.updated, tz)}; times in the visitor's timezone, ${tz}; now is ${when(new Date().toISOString(), tz)}):`,
    'FC Barcelona' + (d.barca?.standing ? ` (${d.barca.standing})` : '') + ':', ...lines(d.barca),
    "Messi's teams (Inter Miami, Argentina):", ...lines(d.messi, true),
  ].join('\n');
}

// Runs the commands the recent questions need; returns [{ name, text }].
async function runTools(messages, tz, request, waitUntil) {
  const asked = messages.filter(m => m.role === 'user').slice(-3).map(m => m.content).join('\n');
  const tools = [];
  if (FOOTBALL.test(asked)) {
    try { tools.push({ name: 'latest', text: footballText((await footballData(request, waitUntil)).data, tz) }); }
    catch { tools.push({ name: 'latest', text: 'Output of /latest: the match feed is unavailable right now.' }); }
  }
  return tools;
}

export function onRequestGet({ env }) {
  return Response.json({ live: isLive(env) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.some(re => re.test(origin))) return new Response('Forbidden', { status: 403 });
  if (!isLive(env)) return Response.json({ live: false }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return new Response('Bad request', { status: 400 });

  const tz = typeof body.tz === 'string' && body.tz.length < 64 && zoneOk(body.tz) ? body.tz : 'UTC';
  const [notes, tools] = await Promise.all([loadNotes(env), runTools(messages, tz, request, waitUntil)]);
  if (!notes) return Response.json({ live: false }, { status: 503 });

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://parth.party',
      'X-Title': 'parth.party',
    },
    body: JSON.stringify({
      models: modelList(env),
      stream: true,
      temperature: 0.3,
      // Some fallbacks think before answering: keep that short and out of the reply.
      reasoning: { effort: 'low', exclude: true },
      max_tokens: 700,
      messages: [{ role: 'system', content: systemPrompt(notes, tools) }, ...messages],
    }),
  });
  if (!upstream.ok || !upstream.body) {
    console.log('openrouter error', upstream.status, await upstream.text().catch(() => ''));
    return new Response('The model is unavailable right now.', { status: 502 });
  }

  // OpenRouter sends server-sent events; forward only the text deltas.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const toText = new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch { /* keep-alive comments and partial lines */ }
      }
    },
  });

  return new Response(upstream.body.pipeThrough(toText), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Tools': tools.map(t => t.name).join(',') },
  });
}
