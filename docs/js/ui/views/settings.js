// Configurações: cálculo do tempo, backup no Drive, exportar/importar e informações.
import { html, setHtml, $, onAction, formValues } from '../dom.js';
import { icon } from '../icons.js';
import { toast, confirmDialog } from '../overlay.js';
import * as store from '../../data/store.js';
import { state } from '../../data/store.js';
import { SIZE_LABELS, formatDecimal, parseDecimal } from '../../core/calc.js';
import { buildExport, entriesToCsv } from '../../core/transfer.js';
import { today, formatDateTime } from '../../core/dates.js';
import { downloadText, pickTextFile } from '../../services/files.js';
import * as bk from '../../services/backup.js';
import { backup } from '../../services/backup.js';
import { openVersionPicker, importFromText } from '../restore.js';

export const APP_VERSION = '1.1.3';

function readingForm() {
  const s = state.settings;
  return html`<form class="card" id="calc-form" novalidate>
    <div class="row-2">
      <label class="field"><span>Minutos por página</span>
        <input name="minPerPage" inputmode="decimal" value="${formatDecimal(s.minPerPage)}">
      </label>
      <label class="field"><span>Palavras por minuto</span>
        <input name="wpm" inputmode="numeric" value="${formatDecimal(s.wpm)}">
      </label>
    </div>
    <span class="field-label">Tamanhos rápidos de artigo (minutos)</span>
    <div class="row-2">
      ${Object.entries(SIZE_LABELS).map(
        ([key, label]) => html`<label class="field"><span>${label}</span>
          <input name="size_${key}" inputmode="decimal" value="${formatDecimal(s.sizes[key])}">
        </label>`,
      )}
    </div>
    <p class="hint">Mudanças valem para os próximos registros. O histórico não é recalculado; edite um registro se quiser ajustá-lo.</p>
    <div class="form-error" id="calc-error"></div>
    <button type="submit" class="btn btn-primary btn-block">Salvar</button>
  </form>`;
}

function driveSection() {
  if (!bk.isConfigured()) {
    return html`<div class="card">
      <p style="margin-top:0">O backup no Google Drive ainda não foi configurado.</p>
      <p class="small muted" style="margin-bottom:0">Para ativar, crie um Client ID gratuito no Google Cloud e cole em <code>docs/js/config.js</code>. O passo a passo está no README. Enquanto isso, use "Exportar backup (JSON)" abaixo.</p>
    </div>`;
  }
  if (!backup.enabled) {
    return html`<div class="card">
      <p style="margin-top:0">Salve uma cópia automática dos seus dados numa pasta oculta do seu Google Drive. O app só tem acesso a essa pasta, não aos seus arquivos.</p>
      <button type="button" class="btn btn-primary btn-block" data-action="connect">${icon('cloud')} Conectar com Google</button>
      ${backup.error ? html`<p class="form-error" style="margin:12px 0 0">${backup.error}</p>` : ''}
    </div>`;
  }
  const statusText = backup.busy
    ? 'Enviando…'
    : backup.error
      ? backup.error
      : backup.pending
        ? bk.hasToken()
          ? 'Alterações serão enviadas em instantes'
          : 'Há alterações sem backup (toque em "Backup agora")'
        : 'Em dia';
  return html`<div class="card">
    <div class="kv"><span>Conta</span><span>${backup.email || 'Conta Google conectada'}</span></div>
    <div class="kv"><span>Último backup</span><span>${backup.lastBackupAt ? formatDateTime(backup.lastBackupAt) : 'Ainda não feito'}</span></div>
    <div class="kv"><span>Situação</span><span>${statusText}</span></div>
    ${!bk.hasToken() ? html`<p class="small muted" style="margin:6px 0 0">O acesso do Google dura cerca de 1 hora. Depois disso, os botões pedem login de novo (um toque).</p>` : ''}
    <div class="btn-row" style="margin-top:12px">
      <button type="button" class="btn btn-primary" data-action="backup-now" style="flex:1" ${backup.busy ? 'disabled' : ''}>${icon('upload')} Backup agora</button>
      <button type="button" class="btn" data-action="restore" style="flex:1">${icon('download')} Restaurar</button>
    </div>
    <button type="button" class="btn btn-ghost danger btn-block" data-action="disconnect" style="margin-top:6px">Desconectar</button>
  </div>`;
}

/** Ajuda a diagnosticar o "Compartilhar": só funciona no app instalado (não no navegador nem em atalho). */
function openMode() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return standalone ? 'app instalado' : 'navegador ou atalho';
}

async function storageInfo() {
  try {
    const persisted = (await navigator.storage?.persisted?.()) ?? null;
    return persisted === null ? 'não informado' : persisted ? 'protegido contra limpeza automática' : 'pode ser limpo pelo navegador se faltar espaço';
  } catch {
    return 'não informado';
  }
}

export default {
  title: 'Configurações',
  tab: null,
  back: () => '#/inicio',
  /** Atualiza só o bloco do Drive (não apaga o que está sendo digitado no formulário). */
  refresh(main) {
    const el = $('#drive-section', main);
    if (el) setHtml(el, driveSection());
  },
  render(main) {
    setHtml(
      main,
      html`<section class="settings-group">
          <h2>Cálculo do tempo</h2>
          ${readingForm()}
        </section>

        <section class="settings-group">
          <h2>Backup no Google Drive</h2>
          <div id="drive-section">${driveSection()}</div>
        </section>

        <section class="settings-group">
          <h2>Seus dados</h2>
          <div class="card">
            <div class="list">
              <button type="button" class="btn btn-block" data-action="export-json">${icon('download')} Exportar backup (JSON)</button>
              <button type="button" class="btn btn-block" data-action="import-json">${icon('upload')} Importar backup (JSON)</button>
              <button type="button" class="btn btn-block" data-action="export-csv">${icon('download')} Exportar histórico (CSV)</button>
            </div>
            <p class="small muted" style="margin-bottom:0">Seus dados ficam neste aparelho (no navegador). Importar substitui tudo, sempre com confirmação.</p>
          </div>
        </section>

        <section class="settings-group">
          <h2>Sobre</h2>
          <div class="card">
            <div class="kv"><span>Itens</span><span>${state.items.length}</span></div>
            <div class="kv"><span>Registros de leitura</span><span>${state.entries.length}</span></div>
            <div class="kv"><span>Armazenamento</span><span id="storage-info">…</span></div>
            <div class="kv"><span>Aberto como</span><span>${openMode()}</span></div>
            <div class="kv"><span>Versão</span><span>${APP_VERSION}</span></div>
          </div>
        </section>
        <footer class="app-foot">Leituras · sem cronômetro, sem anúncios, sem servidor.</footer>`,
    );

    storageInfo().then((text) => {
      const el = $('#storage-info', main);
      if (el) el.textContent = text;
    });

    $('#calc-form', main).addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = formValues(e.target);
      const nums = {
        minPerPage: parseDecimal(v.minPerPage),
        wpm: parseDecimal(v.wpm),
        sizes: Object.fromEntries(Object.keys(SIZE_LABELS).map((k) => [k, parseDecimal(v[`size_${k}`])])),
      };
      const all = [nums.minPerPage, nums.wpm, ...Object.values(nums.sizes)];
      if (all.some((n) => !Number.isFinite(n) || n <= 0)) {
        $('#calc-error', main).textContent = 'Use apenas números maiores que zero (ex.: 1,5).';
        return;
      }
      await store.saveSettings(nums);
      toast('Configurações salvas');
    });

    onAction(main, {
      connect: async () => {
        try {
          await bk.connect();
          toast(backup.error || (backup.cloudNewer ? 'Conectado. Há um backup mais recente no Drive.' : 'Conectado ao Google Drive'), {
            kind: backup.error ? 'error' : 'info',
          });
        } catch (err) {
          toast(err.message, { kind: 'error' });
        }
      },
      'backup-now': async () => {
        try {
          await bk.backupNow();
          toast('Backup salvo no Drive');
        } catch (err) {
          toast(err.message, { kind: 'error' });
        }
      },
      restore: () => openVersionPicker(),
      disconnect: async () => {
        const ok = await confirmDialog({
          title: 'Desconectar do Drive',
          message: 'O backup automático para. Os backups já salvos continuam no seu Drive e os dados deste aparelho não mudam.',
          confirmLabel: 'Desconectar',
        });
        if (ok) bk.disconnect();
      },
      'export-json': () => {
        const data = buildExport(state);
        downloadText(`leituras-backup-${today()}.json`, JSON.stringify(data, null, 2));
      },
      'import-json': async () => {
        try {
          const text = await pickTextFile();
          if (text != null) await importFromText(text);
        } catch (err) {
          toast(err.message, { kind: 'error' });
        }
      },
      'export-csv': () => {
        if (!state.entries.length) {
          toast('Ainda não há registros para exportar.');
          return;
        }
        // BOM para o Excel reconhecer os acentos.
        downloadText(`leituras-historico-${today()}.csv`, `﻿${entriesToCsv(state.entries, store.itemsById())}`, 'text/csv');
      },
    });
  },
};
