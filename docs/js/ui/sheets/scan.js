// Leitor do código de barras (ISBN) pela câmera. Usa o BarcodeDetector do navegador
// (Chrome no Android). Onde não existe, o botão nem aparece.
import { html } from '../dom.js';
import { openSheet } from '../overlay.js';

export function canScan() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Resolve com o ISBN lido (978/979…) ou null se o usuário fechar. */
export function scanIsbn() {
  return new Promise((resolve) => {
    let stream = null;
    let timer = null;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      resolve(value);
    };
    const sheet = openSheet({
      title: 'Ler código de barras',
      content: html`<p class="hint" style="margin-top:0">Aponte a câmera para o código de barras da contracapa (começa com 978 ou 979).</p>
        <video playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:4/3;object-fit:cover"></video>
        <p class="status-line" id="scan-status">Abrindo a câmera…</p>`,
      onClose: () => finish(null),
    });
    const video = sheet.body.querySelector('video');
    const status = sheet.body.querySelector('#scan-status');

    (async () => {
      try {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (done) return finish(null);
        video.srcObject = stream;
        await video.play();
        status.textContent = 'Procurando o código…';
        timer = setInterval(async () => {
          try {
            const codes = await detector.detect(video);
            const isbn = codes.map((c) => c.rawValue).find((v) => /^97[89]\d{10}$/.test(v));
            if (isbn) {
              finish(isbn);
              sheet.close();
            }
          } catch {
            /* quadro ainda não pronto */
          }
        }, 300);
      } catch (err) {
        status.textContent =
          err?.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere nas configurações do navegador.' : 'Não foi possível abrir a câmera neste aparelho.';
      }
    })();
  });
}
