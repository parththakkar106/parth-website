// POST /api/chat  -> streams the model's answer as text/plain.
// GET  /api/chat  -> { live: boolean } so the page can show whether answers are live or scripted.
//
// Configure in Cloudflare Pages > Settings > Variables and secrets:
//   OPENROUTER_API_KEY  (secret)  your OpenRouter key
//   OPENROUTER_MODEL    (text)    model id, e.g. one of OpenRouter's ":free" models
// Until both are set, POST returns 503 and the page falls back to scripted demo answers.
import { SYSTEM_PROMPT } from './_knowledge.js';

const MAX_TURNS = 8;
const MAX_CHARS = 1000;
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?parth\.party$/, /^https:\/\/[a-z0-9-]+\.parth-party\.pages\.dev$/, /^https:\/\/parth-party\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const isLive = env => Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL);

export function onRequestGet({ env }) {
  return Response.json({ live: isLive(env) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
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

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://parth.party',
      'X-Title': 'parth.party',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      stream: true,
      temperature: 0.3,
      max_tokens: 450,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
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
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
