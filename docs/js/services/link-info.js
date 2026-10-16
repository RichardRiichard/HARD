// Dados de um link de artigo/post. Para posts do Substack (endereços com /p/nome-do-post),
// lê a API pública do post (título, autor, palavras, data, imagem).
// O Substack bloqueia a leitura direta pelo navegador (CORS), então a busca tenta, em ordem:
// direto → seu intermediário na Cloudflare (config.js) → intermediários públicos gratuitos.
// Se tudo falhar, devolve só o que dá para tirar do próprio endereço.

import { toLocalDate } from '../core/dates.js';
import { LINK_PROXY_URL } from '../config.js';

const TIMEOUT_MS = 8000;

/** Endereços a tentar, em ordem, para ler uma URL de API que bloqueia CORS. */
export function candidateUrls(apiUrl, proxyUrl = LINK_PROXY_URL) {
  const enc = encodeURIComponent(apiUrl);
  const list = [apiUrl];
  if (proxyUrl && proxyUrl.trim()) list.push(`${proxyUrl.trim().replace(/\/+$/, '')}/?url=${enc}`);
  list.push(`https://api.allorigins.win/raw?url=${enc}`, `https://api.codetabs.com/v1/proxy?quest=${enc}`);
  return list;
}

async function getJson(url, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Primeira resposta válida (com título) entre os candidatos; null se nenhum funcionar. */
export async function fetchPostJson(apiUrl, { fetchImpl = fetch, proxyUrl = LINK_PROXY_URL } = {}) {
  for (const url of candidateUrls(apiUrl, proxyUrl)) {
    try {
      const data = await getJson(url, fetchImpl);
      if (data && typeof data.title === 'string' && data.title.trim()) return data;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/** "https://fulano.substack.com/p/meu-post" -> { origin, slug, publication: 'fulano' } */
export function parsePostUrl(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, '');
  const sub = host.endsWith('.substack.com') ? host.slice(0, -'.substack.com'.length) : null;
  const m = u.pathname.match(/^\/p\/([^/?#]+)/);
  return {
    origin: u.origin,
    host,
    slug: m ? decodeURIComponent(m[1]) : null,
    publication: sub && sub !== 'www' ? sub : null,
    isSubstack: Boolean(sub) || /substack/i.test(host),
  };
}

/** Título legível a partir do slug: "o-poder-da-oracao" -> "O poder da oracao" */
export function titleFromSlug(slug) {
  const text = String(slug || '').replace(/[-_]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** Primeira URL dentro de um texto (o "Compartilhar" do Android às vezes manda o link no texto). */
export function firstUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s<>"']+/);
  return m ? m[0].replace(/[).,;!?]+$/, '') : '';
}

/** Converte a resposta da API de post do Substack (data em AAAA-MM-DD no fuso de São Paulo). */
export function fromSubstackPost(data) {
  const byline = (data.publishedBylines || []).map((b) => b?.name).filter(Boolean).join(', ');
  const posted = data.post_date ? new Date(data.post_date) : null;
  return {
    title: String(data.title || '').trim(),
    author: byline,
    words: Number(data.wordcount) > 0 ? Number(data.wordcount) : null,
    publishedOn: posted && !Number.isNaN(posted.getTime()) ? toLocalDate(posted) : null,
    coverUrl: /^https:\/\//.test(data.cover_image || '') ? data.cover_image : '',
  };
}

/**
 * Retorna { title, site, words, publishedOn, coverUrl, fetched, note }.
 * fetched=false quando não foi possível ler a página (só dados do endereço).
 */
export async function fetchLinkInfo(url) {
  const parsed = parsePostUrl(url);
  if (!parsed) return { title: '', site: '', words: null, fetched: false, note: 'Link inválido.' };
  const base = {
    title: titleFromSlug(parsed.slug),
    site: parsed.publication || parsed.host,
    words: null,
    publishedOn: null,
    coverUrl: '',
    fetched: false,
    note: '',
  };
  if (!parsed.slug) return { ...base, title: '', note: 'Não é um link de post (/p/…); preencha os dados.' };
  if (navigator.onLine === false) return { ...base, note: 'Sem internet: preenchido só pelo endereço.' };

  const data = await fetchPostJson(`${parsed.origin}/api/v1/posts/${encodeURIComponent(parsed.slug)}`);
  if (!data) {
    return {
      ...base,
      note: LINK_PROXY_URL
        ? 'Não foi possível ler os dados do post agora; preenchido só pelo endereço.'
        : 'O Substack bloqueou a leitura; preenchido só pelo endereço. Configure o intermediário (README) para funcionar sempre.',
    };
  }
  const post = fromSubstackPost(data);
  return {
    title: post.title || base.title,
    site: post.author ? `${post.author}${parsed.publication ? ` (${parsed.publication})` : ''}` : base.site,
    words: post.words,
    publishedOn: post.publishedOn,
    coverUrl: post.coverUrl,
    fetched: true,
    note: '',
  };
}
