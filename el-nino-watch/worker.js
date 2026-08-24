/**
 * El Niño Watch — Anthropic proxy (Cloudflare Worker)
 *
 * Why this exists: the dashboard is a static page on a public URL. An API key
 * pasted into it lives in that browser, which is fine for your own device but
 * means the key is present in the page. This Worker holds the key server-side
 * instead, so the browser never sees it.
 *
 * Deploy (about five minutes, free tier):
 *   1. npm install -g wrangler && wrangler login
 *   2. wrangler deploy el-nino-watch/worker.js --name elnino-proxy
 *   3. wrangler secret put ANTHROPIC_API_KEY --name elnino-proxy
 *   4. wrangler secret put SHARED_SECRET   --name elnino-proxy   (any random string)
 *   5. Paste the worker URL into the dashboard: Claude → proxy URL.
 *      Append the shared secret as a query string, e.g.
 *      https://elnino-proxy.<you>.workers.dev/?s=<your-shared-secret>
 *
 * The shared secret is not real authentication — it just stops a stranger who
 * finds the worker URL from spending your balance. The hard backstop is a spend
 * limit set in the Anthropic Console.
 */

const ALLOWED_ORIGINS = [
  'https://karim33mokdad-svg.github.io',
  'http://localhost:8000',
];

/* Only the models the dashboard actually uses, so a leaked URL cannot be
   pointed at something far more expensive. */
const ALLOWED_MODELS = new Set(['claude-haiku-4-5', 'claude-opus-5']);
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = { ...cors(origin), 'content-type': 'application/json' };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST')
      return new Response(JSON.stringify({ error: { message: 'POST only' } }), { status: 405, headers });

    if (env.SHARED_SECRET) {
      const given = new URL(request.url).searchParams.get('s');
      if (given !== env.SHARED_SECRET)
        return new Response(JSON.stringify({ error: { message: 'Bad or missing shared secret.' } }),
          { status: 401, headers });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: { message: 'Invalid JSON' } }), { status: 400, headers }); }

    if (!ALLOWED_MODELS.has(body.model))
      return new Response(JSON.stringify({ error: { message: `Model ${body.model} is not allowed by this proxy.` } }),
        { status: 400, headers });

    body.max_tokens = Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP);
    delete body.stream;                       // this proxy returns whole responses only

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    return new Response(await upstream.text(), { status: upstream.status, headers });
  },
};
