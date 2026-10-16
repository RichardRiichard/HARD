// Capas guardadas no próprio app: imagem reduzida (JPEG pequeno) em formato data URL.
// Fica no banco local e no backup, então funciona offline e não depende de sites externos.

export const COVER_WIDTH = 240;

/** Reduz uma imagem (arquivo da galeria/câmera) para capa. */
export async function imageFileToCover(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      el.src = url;
    });
    return canvasToCover(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Desenha uma fonte (imagem ou canvas) reduzida para COVER_WIDTH e devolve JPEG. */
export function canvasToCover(source, width, height) {
  const scale = Math.min(1, COVER_WIDTH / width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
