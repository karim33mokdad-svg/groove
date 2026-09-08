/**
 * El Niño Watch — model proxy (Cloudflare Worker)
 *
 * Holds credentials server-side so the dashboard, which is a static page on a
 * public URL, never carries an API key. It also makes the model provider a
 * deployment decision rather than something baked into the page: the page
 * always calls this Worker, and this Worker decides who answers.
 *
 *   PROVIDER = "anthropic"   → Anthropic API (default). Needs ANTHROPIC_API_KEY.
 *   PROVIDER = "workers-ai"  → Cloudflare Workers AI. No extra key, runs on
 *                              Cloudflare's own free allocation, but weaker
 *                              prose than the Anthropic models.
 *
 * Deploy:
 *   npm install -g wrangler && wrangler login
 *   wrangler deploy                                  (from this directory)
 *   wrangler secret put SHARED_SECRET                (any random string)
 *   wrangler secret put ANTHROPIC_API_KEY            (required on the default)
 *
 * It serves two things:
 *
 *   POST /        the model proxy (Claude briefings and open questions)
 *   GET  /fetch   a read-only relay for public data that sends no CORS headers
 *                 — NOAA's index files and the news feeds. Restricted to an
 *                 explicit host allowlist so it is not an open proxy.
 *
 * Then paste into the dashboard:
 *   Claude → proxy URL      https://elnino-proxy.<you>.workers.dev/?s=<secret>
 *   News → your relay URL   https://elnino-proxy.<you>.workers.dev/fetch?s=<secret>
 *
 * The shared secret is not authentication — it stops a stranger who finds the
 * URL from spending your allocation. Set a spend limit at the provider too.
 */

const ALLOWED_ORIGINS = [
  'https://karim33mokdad-svg.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8099',
];

/* ── GET /fetch?url=… ──────────────────────────────────────────────────────
   A read-only relay for public data that sends no CORS headers, so the
   dashboard stops depending on free public proxies. Those are volunteer
   infrastructure: they go down, they rate-limit, and corsproxy.io began
   requiring an API key, which turned every blocked source into an identical
   401. This one is yours, so it cannot do that.

   It is deliberately narrow: GET only, no request headers or body forwarded,
   an explicit host allowlist, and a response size cap. That keeps it useless
   as an open proxy if the URL ever leaks — an open relay would let a stranger
   launder traffic through your account.

   To add a host, add its exact hostname here and redeploy. */
const RELAY_HOSTS = new Set([
  'www.cpc.ncep.noaa.gov',      // ONI, RONI and the weekly Niño SSTs
  'reliefweb.int',
  'api.reliefweb.int',
  'api.gdeltproject.org',
  'feeds.bbci.co.uk',
  'www.theguardian.com',
  'www.climate.gov',
  'eonet.gsfc.nasa.gov',
]);

const RELAY_MAX_BYTES = 4 * 1024 * 1024;

async function relayFetch(request, env, headers) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return json({ error: { message: 'Missing ?url=' } }, 400, headers);

  let u;
  try { u = new URL(target); }
  catch { return json({ error: { message: 'Not a valid URL' } }, 400, headers); }

  if (u.protocol !== 'https:')
    return json({ error: { message: 'https only' } }, 400, headers);
  if (!RELAY_HOSTS.has(u.hostname))
    return json({ error: { message: `Host ${u.hostname} is not on this relay's allowlist.` } }, 403, headers);

  /* Identify honestly, but in the shape servers expect. A bare product token
     gets rejected outright by some government and publisher sites, which is
     indistinguishable from the feed being down; the Mozilla prefix is the
     convention that keeps those filters happy. Sending Accept matters too —
     some feed hosts answer 406 without it. */
  const res = await fetch(u.toString(), {
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; el-nino-watch/1.0; +https://github.com/karim33mokdad-svg/groove)',
      'accept': 'application/rss+xml, application/atom+xml, application/xml, application/json, text/*;q=0.9, */*;q=0.8',
      'accept-language': 'en',
    },
    redirect: 'follow',
    /* Cache successes only. Caching a 403 for ten minutes turns a transient
       upstream refusal into something that looks permanent while you debug it. */
    cf: { cacheEverything: true,
          cacheTtlByStatus: { '200-299': 600, '300-399': 0, '400-499': 0, '500-599': 0 } },
  });
  const body = await res.text();
  if (body.length > RELAY_MAX_BYTES)
    return json({ error: { message: 'Response too large' } }, 502, headers);

  /* Pass the upstream status through so the page can tell "source is down"
     from "relay is down" — collapsing both into 200 would hide real failures. */
  return new Response(body, {
    status: res.status,
    headers: {
      ...headers,
      'content-type': res.headers.get('content-type') || 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

/* Only the models this dashboard uses, so a leaked URL cannot be pointed at
   something far more expensive. */
const ALLOWED_ANTHROPIC = new Set(['claude-haiku-4-5', 'claude-opus-5']);
const MAX_TOKENS_CAP = 2000;

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers });

/* Both providers are normalised to the Anthropic response shape, so the page
   needs no knowledge of which one answered. */
function normalise(text, model, usage) {
  return {
    content: [{ type: 'text', text: String(text ?? '') }],
    model,
    usage: {
      input_tokens: (usage && (usage.prompt_tokens ?? usage.input_tokens)) || 0,
      output_tokens: (usage && (usage.completion_tokens ?? usage.output_tokens)) || 0,
    },
  };
}

async function viaWorkersAI(env, body) {
  const model = env.WORKERS_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  if (!env.AI) throw new Error('No AI binding on this Worker. Add [ai] binding = "AI" to wrangler.toml and redeploy.');

  /* Anthropic keeps the system prompt out of messages[]; the open chat models
     expect it as the first message. */
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: String(body.system) });
  for (const m of body.messages || []) {
    messages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string'
        ? m.content
        : (m.content || []).map(c => c.text || '').join('\n'),
    });
  }

  const out = await env.AI.run(model, { messages, max_tokens: body.max_tokens });

  /* Response shape has varied across models and runtime versions, so read it
     tolerantly rather than assuming one. */
  const text = typeof out === 'string' ? out
    : out?.response
    ?? out?.result?.response
    ?? out?.choices?.[0]?.message?.content
    ?? '';
  if (!text) throw new Error('Workers AI returned no text. Model: ' + model);

  return normalise(text, model, out && out.usage);
}

async function viaAnthropic(env, body) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.');
  if (!ALLOWED_ANTHROPIC.has(body.model)) throw new Error(`Model ${body.model} is not allowed by this proxy.`);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try { msg = JSON.parse(text)?.error?.message || msg; } catch {}
    throw new Error('Anthropic ' + res.status + ' — ' + msg);
  }
  return JSON.parse(text);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = { ...cors(origin), 'content-type': 'application/json' };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });

    if (env.SHARED_SECRET) {
      const given = new URL(request.url).searchParams.get('s');
      if (given !== env.SHARED_SECRET)
        return json({ error: { message: 'Bad or missing shared secret.' } }, 401, headers);
    }

    /* The data relay is a GET; the model proxy below is a POST. */
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/fetch') {
      if (request.method !== 'GET') return json({ error: { message: 'GET only' } }, 405, headers);
      try { return await relayFetch(request, env, { ...cors(origin) }); }
      catch (e) { return json({ error: { message: String(e && e.message || e) } }, 502, headers); }
    }

    if (request.method !== 'POST') return json({ error: { message: 'POST only' } }, 405, headers);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: { message: 'Invalid JSON' } }, 400, headers); }

    body.max_tokens = Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP);
    delete body.stream;                    // this proxy returns whole responses only

    /* Anthropic unless told otherwise — chosen for reliability. Workers AI
       remains available via PROVIDER or ?provider=workers-ai. */
    const provider = (new URL(request.url).searchParams.get('provider') || env.PROVIDER || 'anthropic')
      .toLowerCase();

    try {
      const out = provider === 'anthropic'
        ? await viaAnthropic(env, body)
        : await viaWorkersAI(env, body);
      out.provider = provider;
      return json(out, 200, headers);
    } catch (e) {
      return json({ error: { message: String(e && e.message || e) } }, 502, headers);
    }
  },
};
