// Dados de um link de artigo/post. Para posts do Substack (endereços com /p/nome-do-post),
// tenta a API pública do post (título, autor, nº de palavras). Se o Substack bloquear a
// leitura pelo navegador, devolve só o que dá para tirar do próprio endereço.

const TIMEOUT_MS = 10000;

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

/** Converte a resposta da API de post do Substack. */
export function fromSubstackPost(data) {
  const byline = (data.publishedBylines || []).map((b) => b?.name).filter(Boolean).join(', ');
  return {
    title: String(data.title || '').trim(),
    author: byline,
    words: Number(data.wordcount) > 0 ? Number(data.wordcount) : null,
  };
}

/**
 * Retorna { title, site, words, fetched, note }.
 * fetched=false quando não foi possível ler a página (só dados do endereço).
 */
export async function fetchLinkInfo(url) {
  const parsed = parsePostUrl(url);
  if (!parsed) return { title: '', site: '', words: null, fetched: false, note: 'Link inválido.' };
  const base = {
    title: titleFromSlug(parsed.slug),
    site: parsed.publication || parsed.host,
    words: null,
    fetched: false,
    note: '',
  };
  if (!parsed.slug) return { ...base, title: '', note: 'Não é um link de post (/p/…); preencha os dados.' };
  if (navigator.onLine === false) return { ...base, note: 'Sem internet: preenchido só pelo endereço.' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${parsed.origin}/api/v1/posts/${encodeURIComponent(parsed.slug)}`, {
      signal: ctrl.signal,
      credentials: 'omit',
    });
    if (!res.ok) throw new Error(String(res.status));
    const post = fromSubstackPost(await res.json());
    return {
      title: post.title || base.title,
      site: post.author ? `${post.author}${parsed.publication ? ` (${parsed.publication})` : ''}` : base.site,
      words: post.words,
      fetched: true,
      note: '',
    };
  } catch {
    return { ...base, note: 'O site não permitiu ler os dados; preenchido só pelo endereço. Confira o título.' };
  } finally {
    clearTimeout(timer);
  }
}
