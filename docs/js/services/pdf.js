// Lê título, autor, páginas (e opcionalmente palavras) de um PDF escolhido pelo usuário.
// O PDF não é salvo no app; só os dados extraídos. Usa pdf.js (Apache 2.0) incluído em vendor/,
// carregado apenas quando necessário.
import { countWords } from '../core/calc.js';

const LIB_URL = new URL('../../vendor/pdfjs/pdf.min.js', import.meta.url).href;
const WORKER_URL = new URL('../../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;

/** Contar palavras só em PDFs curtos (artigos); em livros seria lento e desnecessário. */
export const MAX_PAGES_FOR_WORDS = 80;

let libPromise = null;
function loadLib() {
  if (!libPromise) {
    libPromise = import(LIB_URL)
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
        return lib;
      })
      .catch((err) => {
        libPromise = null;
        throw new Error(`Não foi possível carregar o leitor de PDF (${err.message}). Abra o app com internet uma vez.`);
      });
  }
  return libPromise;
}

/** Título "bonito" a partir do nome do arquivo. */
export function titleFromFileName(name) {
  return String(name || '')
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retorna { title, author, pages, words } — words é null se o PDF for longo
 * ou se não tiver texto (ex.: digitalizado como imagem).
 */
export async function readPdf(file) {
  const pdfjs = await loadLib();
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    // isEvalSupported: false evita execução de código vindo de fontes do PDF.
    doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new Error('Este PDF tem senha. Remova a senha e tente de novo.');
    throw new Error('Não foi possível ler este arquivo. Ele é mesmo um PDF?');
  }
  try {
    const pages = doc.numPages;
    const meta = await doc.getMetadata().catch(() => null);
    const metaTitle = String(meta?.info?.Title || '').trim();
    const author = String(meta?.info?.Author || '').trim();
    let words = null;
    if (pages <= MAX_PAGES_FOR_WORDS) {
      let count = 0;
      for (let i = 1; i <= pages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        count += countWords(content.items.map((it) => it.str).join(' '));
        page.cleanup();
      }
      words = count > 0 ? count : null;
    }
    // Títulos de metadados costumam vir como "Microsoft Word - arquivo.docx"; nesses casos usa o nome do arquivo.
    const useMeta = metaTitle && !/^(microsoft word|untitled|sem título)|\.(docx?|pdf)$/i.test(metaTitle);
    return { title: useMeta ? metaTitle : titleFromFileName(file.name), author, pages, words };
  } finally {
    doc.destroy();
  }
}
