// Formulário de artigo/blog: título, site, URL e tempo (minutos, páginas, tamanho ou texto colado).
// Atalhos: buscar dados do link (Substack) e ler um PDF.
import { html, $, formValues, setHtml } from '../dom.js';
import { openSheet } from '../overlay.js';
import { icon } from '../icons.js';
import { state } from '../../data/store.js';
import {
  countWords,
  wordsToMinutes,
  sizeMinutes,
  parseDecimal,
  bookMinutes,
  SIZE_LABELS,
  formatDecimal,
  formatInt,
} from '../../core/calc.js';
import { createArticle } from '../../core/progress.js';
import { today, isValidDate } from '../../core/dates.js';
import { addArticle, saveItem } from '../actions.js';
import { fetchLinkInfo, parsePostUrl } from '../../services/link-info.js';
import { readPdf } from '../../services/pdf.js';
import { pickFile } from '../../services/files.js';

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Calcula os minutos a partir do modo escolhido. */
function computeMinutes(values) {
  const { sizes, wpm, minPerPage } = state.settings;
  if (values.timeMode === 'tamanho') return { minutes: sizeMinutes(values.size, sizes), wordCount: null, pageCount: null };
  if (values.timeMode === 'palavras') {
    const words = countWords(values.text);
    return { minutes: wordsToMinutes(words, wpm), wordCount: words, pageCount: null };
  }
  if (values.timeMode === 'paginas') {
    const pages = Number(String(values.pages).trim());
    const ok = Number.isInteger(pages) && pages > 0;
    return { minutes: ok ? bookMinutes(pages, minPerPage) : 0, wordCount: null, pageCount: ok ? pages : null };
  }
  const m = parseDecimal(values.minutes);
  return { minutes: Number.isFinite(m) && m > 0 ? m : 0, wordCount: null, pageCount: null };
}

const MODES = [
  ['minutos', 'Minutos'],
  ['paginas', 'Páginas'],
  ['tamanho', 'Tamanho'],
  ['palavras', 'Texto'],
];

/**
 * Abre o formulário.
 * - Sem `item`: novo (tipo inicial em `type`). `prefill` pode trazer { title, site, url } e,
 *   com url, os dados do link são buscados automaticamente.
 * - Com `item`: edição.
 */
export function openArticleForm({ type = 'artigo', item = null, prefill = null } = {}) {
  const editing = Boolean(item);
  const { sizes, wpm, minPerPage } = state.settings;
  const t = item?.type || type;
  const src = item || prefill || {};
  const startMode = item?.timeMode === 'paginas' ? 'paginas' : 'minutos';

  const sheet = openSheet({
    title: editing ? 'Editar' : t === 'blog' ? 'Novo post de blog' : 'Novo artigo',
    content: html`<form novalidate>
      <div class="field">
        <span class="field-label">Tipo</span>
        <div class="seg" role="radiogroup">
          <label><input type="radio" name="type" value="artigo" ${t === 'artigo' ? 'checked' : ''}>Artigo</label>
          <label><input type="radio" name="type" value="blog" ${t === 'blog' ? 'checked' : ''}>Post de blog</label>
        </div>
      </div>
      <div class="field">
        <span class="field-label">Link (opcional)</span>
        <div class="search-bar" style="margin:0">
          <input name="url" type="url" inputmode="url" autocomplete="off" value="${src.url || ''}" placeholder="Cole o link (Substack preenche sozinho)" aria-label="Link">
          <button type="button" class="btn" data-fetch aria-label="Buscar dados do link">${icon('search')}</button>
        </div>
        <small id="art-link-note" class="muted"></small>
      </div>
      <label class="field"><span>Título</span>
        <input name="title" required autocomplete="off" value="${src.title || ''}" ${editing || src.url ? '' : 'autofocus'}>
      </label>
      <label class="field"><span>Site ou autor</span>
        <input name="site" autocomplete="off" value="${src.site || ''}" placeholder="Ex.: Ultimato, nome do Substack">
      </label>
      ${editing ? '' : html`<button type="button" class="btn btn-sm btn-block" data-pdf style="margin:-4px 0 14px">${icon('page')} Ler dados de um PDF</button>`}

      <div class="field">
        <span class="field-label">Tempo de leitura</span>
        <div class="seg" role="radiogroup">
          ${MODES.map(([key, label]) => html`<label><input type="radio" name="timeMode" value="${key}" ${key === startMode ? 'checked' : ''}>${label}</label>`)}
        </div>
      </div>
      <div data-mode="minutos">
        <label class="field"><span>Minutos de leitura</span>
          <input name="minutes" inputmode="decimal" autocomplete="off" value="${item && item.timeMode !== 'paginas' ? formatDecimal(item.minutes) : ''}" placeholder="Ex.: 8">
        </label>
      </div>
      <div data-mode="paginas" hidden>
        <label class="field"><span>Quantidade de páginas</span>
          <input name="pages" inputmode="numeric" autocomplete="off" value="${item?.pageCount || ''}" placeholder="Ex.: 12">
          <small>Usa ${formatDecimal(minPerPage)} min por página (ajustável em Configurações).</small>
        </label>
      </div>
      <div data-mode="tamanho" hidden>
        <div class="sizes field">
          ${Object.entries(SIZE_LABELS).map(
            ([key, label]) => html`<label><input type="radio" name="size" value="${key}" ${key === 'medio' ? 'checked' : ''}>${label}<small>${formatDecimal(sizes[key])} min</small></label>`,
          )}
        </div>
      </div>
      <div data-mode="palavras" hidden>
        <label class="field"><span>Cole o texto (não é salvo, só contado)</span>
          <textarea name="text" placeholder="Cole aqui o conteúdo do artigo"></textarea>
        </label>
      </div>
      <div class="calc-preview" id="art-preview"></div>

      ${editing
        ? html`<p class="hint">Mudar o tempo aqui não altera leituras já registradas. Para isso, edite o registro no histórico.</p>`
        : html`<div class="field">
            <span class="field-label">Situação</span>
            <div class="seg" role="radiogroup">
              <label><input type="radio" name="when" value="lido" checked>Já li</label>
              <label><input type="radio" name="when" value="quero">Quero ler</label>
            </div>
          </div>
          <label class="field" data-when="lido"><span>Data da leitura</span>
            <input type="date" name="date" value="${today()}" max="${today()}">
          </label>`}

      <div class="form-error" id="art-error"></div>
      <div class="actions">
        <button type="submit" class="btn btn-primary btn-block">${editing ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>`,
  });

  const form = $('form', sheet.body);
  const preview = $('#art-preview', sheet.body);
  const error = $('#art-error', sheet.body);
  const linkNote = $('#art-link-note', sheet.body);
  const el = (name) => form.elements[name];
  // Nota sobre a origem do tempo (ex.: "2.150 palavras do Substack"), apagada se o usuário mexer no tempo.
  let sourceNote = '';

  function setMode(mode) {
    for (const r of form.querySelectorAll('input[name=timeMode]')) r.checked = r.value === mode;
  }

  function update() {
    const v = formValues(form);
    for (const node of form.querySelectorAll('[data-mode]')) node.hidden = node.dataset.mode !== v.timeMode;
    const dateField = form.querySelector('[data-when]');
    if (dateField) dateField.hidden = v.when !== 'lido';
    const { minutes, wordCount, pageCount } = computeMinutes(v);
    if (v.timeMode === 'palavras') {
      setHtml(preview, html`${formatInt(wordCount)} palavras ÷ ${wpm} por min = <b>${minutes} min</b>`);
    } else if (v.timeMode === 'paginas') {
      setHtml(
        preview,
        pageCount ? html`${pageCount} pág. × ${formatDecimal(minPerPage)} min = <b>${formatDecimal(minutes)} min</b>` : 'Informe a quantidade de páginas.',
      );
    } else {
      setHtml(
        preview,
        minutes > 0 ? html`Tempo estimado: <b>${formatDecimal(minutes)} min</b>${sourceNote ? html` <span class="muted">(${sourceNote})</span>` : ''}` : 'Informe o tempo de leitura.',
      );
    }
  }

  /** Aplica dados obtidos (link ou PDF) sem apagar o que o usuário já digitou de propósito. */
  function applyInfo({ title, site, words, pages, origin }) {
    if (title && (!el('title').value.trim() || el('title').dataset.auto === '1')) {
      el('title').value = title;
      el('title').dataset.auto = '1';
    }
    if (site && (!el('site').value.trim() || el('site').dataset.auto === '1')) {
      el('site').value = site;
      el('site').dataset.auto = '1';
    }
    if (words) {
      el('minutes').value = String(wordsToMinutes(words, wpm));
      sourceNote = `${formatInt(words)} palavras${origin ? ` · ${origin}` : ''}`;
      setMode('minutos');
    } else if (pages) {
      el('pages').value = String(pages);
      setMode('paginas');
    }
    update();
  }

  let fetchSeq = 0;
  async function fetchLink() {
    const url = el('url').value.trim();
    if (!url) return;
    const parsed = parsePostUrl(url);
    if (!parsed) {
      linkNote.textContent = 'Link inválido.';
      return;
    }
    if (parsed.isSubstack) for (const r of form.querySelectorAll('input[name=type]')) r.checked = r.value === 'blog';
    const id = ++fetchSeq;
    linkNote.textContent = 'Buscando dados do link…';
    const info = await fetchLinkInfo(url);
    if (id !== fetchSeq) return;
    linkNote.textContent = info.fetched ? (info.words ? 'Dados preenchidos pelo link.' : 'Título e autor preenchidos; informe o tempo.') : info.note;
    applyInfo({ title: info.title, site: info.site, words: info.words, origin: info.fetched ? 'pelo link' : '' });
  }

  form.addEventListener('input', (e) => {
    if (e.target.name === 'title' || e.target.name === 'site') e.target.dataset.auto = '';
    if (['minutes', 'pages', 'text', 'timeMode', 'size'].includes(e.target.name)) sourceNote = '';
    update();
  });
  form.addEventListener('change', update);
  el('url').addEventListener('change', () => {
    if (!el('title').value.trim() || el('title').dataset.auto === '1') fetchLink();
    else if (!el('site').value.trim()) el('site').value = hostname(el('url').value.trim());
  });
  $('[data-fetch]', form).addEventListener('click', fetchLink);

  const pdfBtn = $('[data-pdf]', form);
  pdfBtn?.addEventListener('click', async () => {
    try {
      const file = await pickFile('application/pdf,.pdf');
      if (!file) return;
      pdfBtn.disabled = true;
      pdfBtn.textContent = 'Lendo PDF…';
      const info = await readPdf(file);
      applyInfo({ title: info.title, site: info.author, words: info.words, pages: info.words ? null : info.pages, origin: `PDF de ${info.pages} pág.` });
      if (info.words) el('pages').value = String(info.pages);
      linkNote.textContent = '';
    } catch (err) {
      error.textContent = err.message;
    } finally {
      pdfBtn.disabled = false;
      setHtml(pdfBtn, html`${icon('page')} Ler dados de um PDF`);
    }
  });

  update();
  if (!editing && prefill?.title) el('title').dataset.auto = '1';
  if (!editing && prefill && (prefill.words || prefill.pages)) applyInfo(prefill);
  if (!editing && prefill?.url) fetchLink();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    const { minutes, wordCount, pageCount } = computeMinutes(v);
    const title = v.title.trim();
    let message = '';
    if (!title) message = 'Informe o título.';
    else if (!(minutes > 0)) message = 'Informe o tempo de leitura.';
    else if (!editing && v.when === 'lido' && !isValidDate(v.date)) message = 'Informe uma data válida.';
    error.textContent = message;
    if (message) return;

    const timeMode = { tamanho: 'tamanho', palavras: 'palavras', paginas: 'paginas' }[v.timeMode] || 'manual';
    const data = {
      type: v.type,
      title,
      site: v.site.trim(),
      url: v.url.trim(),
      minutes,
      timeMode,
      wordCount,
      pageCount,
    };
    try {
      if (editing) {
        await saveItem({ ...item, ...data, pageCount: timeMode === 'paginas' ? pageCount : null });
      } else {
        await addArticle(createArticle(data), { readOn: v.when === 'lido' ? v.date : null });
      }
      sheet.close();
    } catch (err) {
      error.textContent = err.message;
    }
  });
  return sheet;
}
