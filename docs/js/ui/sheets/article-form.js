// Formulário de artigo/blog: título, site, URL e tempo (minutos, tamanho ou texto colado).
import { html, $, formValues, setHtml } from '../dom.js';
import { openSheet } from '../overlay.js';
import { state } from '../../data/store.js';
import { countWords, wordsToMinutes, sizeMinutes, parseDecimal, SIZE_LABELS, formatDecimal } from '../../core/calc.js';
import { createArticle } from '../../core/progress.js';
import { today, isValidDate } from '../../core/dates.js';
import { addArticle, saveItem } from '../actions.js';

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Calcula os minutos a partir do modo escolhido. */
function computeMinutes(values) {
  const { sizes, wpm } = state.settings;
  if (values.timeMode === 'tamanho') return { minutes: sizeMinutes(values.size, sizes), wordCount: null };
  if (values.timeMode === 'palavras') {
    const words = countWords(values.text);
    return { minutes: wordsToMinutes(words, wpm), wordCount: words };
  }
  const m = parseDecimal(values.minutes);
  return { minutes: Number.isFinite(m) && m > 0 ? m : 0, wordCount: null };
}

/**
 * Abre o formulário. Sem `item`: novo (tipo inicial em `type`). Com `item`: edição.
 */
export function openArticleForm({ type = 'artigo', item = null } = {}) {
  const editing = Boolean(item);
  const { sizes, wpm } = state.settings;
  const t = item?.type || type;

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
      <label class="field"><span>Título</span>
        <input name="title" required autocomplete="off" value="${item?.title || ''}" ${editing ? '' : 'autofocus'}>
      </label>
      <label class="field"><span>Site ou autor</span>
        <input name="site" autocomplete="off" value="${item?.site || ''}" placeholder="Ex.: Ultimato, blog do autor">
      </label>
      <label class="field"><span>URL (opcional)</span>
        <input name="url" type="url" inputmode="url" autocomplete="off" value="${item?.url || ''}" placeholder="https://">
      </label>

      <div class="field">
        <span class="field-label">Tempo de leitura</span>
        <div class="seg" role="radiogroup">
          <label><input type="radio" name="timeMode" value="minutos" checked>Minutos</label>
          <label><input type="radio" name="timeMode" value="tamanho">Tamanho</label>
          <label><input type="radio" name="timeMode" value="palavras">Colar texto</label>
        </div>
      </div>
      <div data-mode="minutos">
        <label class="field"><span>Minutos informados pelo site</span>
          <input name="minutes" inputmode="decimal" autocomplete="off" value="${item ? formatDecimal(item.minutes) : ''}" placeholder="Ex.: 8">
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

  function update() {
    const v = formValues(form);
    for (const el of form.querySelectorAll('[data-mode]')) el.hidden = el.dataset.mode !== v.timeMode;
    const dateField = form.querySelector('[data-when]');
    if (dateField) dateField.hidden = v.when !== 'lido';
    const { minutes, wordCount } = computeMinutes(v);
    if (v.timeMode === 'palavras') {
      setHtml(
        preview,
        html`${wordCount} palavras ÷ ${wpm} por min = <b>${minutes} min</b>`,
      );
    } else {
      setHtml(preview, minutes > 0 ? html`Tempo estimado: <b>${formatDecimal(minutes)} min</b>` : 'Informe o tempo de leitura.');
    }
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.url.addEventListener('blur', () => {
    if (!form.site.value.trim()) form.site.value = hostname(form.url.value.trim());
  });
  update();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    const { minutes, wordCount } = computeMinutes(v);
    const title = v.title.trim();
    let message = '';
    if (!title) message = 'Informe o título.';
    else if (!(minutes > 0)) message = 'Informe o tempo de leitura.';
    else if (!editing && v.when === 'lido' && !isValidDate(v.date)) message = 'Informe uma data válida.';
    error.textContent = message;
    if (message) return;

    const data = {
      type: v.type,
      title,
      site: v.site.trim(),
      url: v.url.trim(),
      minutes,
      timeMode: v.timeMode === 'tamanho' ? 'tamanho' : v.timeMode === 'palavras' ? 'palavras' : 'manual',
      wordCount,
    };
    try {
      if (editing) {
        await saveItem({ ...item, ...data });
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
