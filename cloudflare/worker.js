// Intermediário do app Leituras para ler dados de posts do Substack (Cloudflare Workers, plano gratuito).
// O Substack não permite que outros sites leiam a API dos posts direto do navegador (CORS);
// este Worker busca o post e devolve para o app.
//
// Segurança: só atende o seu app (ALLOWED_ORIGINS) e só a API pública de posts
// (endereços terminando em /api/v1/posts/<nome-do-post>). Não guarda nada.

const ALLOWED_ORIGINS = ['https://richardriichard.github.io', 'http://localhost:5173'];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0], Vary: 'Origin' };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    }
    if (!allowed) return new Response('Origem não permitida', { status: 403, headers: cors });
    if (request.method !== 'GET') return new Response('Método não permitido', { status: 405, headers: cors });

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url'));
    } catch {
      return new Response('URL inválida', { status: 400, headers: cors });
    }
    if (target.protocol !== 'https:' || !/^\/api\/v1\/posts\/[^/]+\/?$/.test(target.pathname)) {
      return new Response('Só posts do Substack', { status: 403, headers: cors });
    }

    const res = await fetch(target.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; LeiturasApp/1.0)' },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  },
};
