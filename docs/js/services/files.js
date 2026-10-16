// Baixar e escolher arquivos locais (exportar/importar).

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Abre o seletor de arquivos e resolve com o texto do arquivo (ou null se cancelar). */
export function pickTextFile(accept = '.json,application/json') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Abre o seletor de arquivos e resolve com o arquivo escolhido (ou null). */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] || null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
