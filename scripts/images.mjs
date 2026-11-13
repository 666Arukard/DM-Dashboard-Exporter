// Kleine, eigenständige PNG-Kopien; niemals externe URLs im lokalen Archiv anzeigen.
export const MAX_IMAGE_BYTES = 64 * 1024;
const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024;

export function imageUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash
    || (new URL(base).protocol === 'https:' && url.protocol !== 'https:')) {
    throw new Error('Bildadresse nicht unterstützt.');
  }
  return url;
}

export async function loadOfflineImage(value, { base = document.baseURI, fetcher = fetch, signal, edges = [256, 192, 128, 64], maxBytes = MAX_IMAGE_BYTES } = {}) {
  const url = imageUrl(value, base);
  const timeout = AbortSignal.timeout(8000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetcher(url.href, {
    signal: combined, mode: 'cors', redirect: 'error', referrerPolicy: 'no-referrer',
    credentials: url.origin === new URL(base).origin ? 'same-origin' : 'omit'
  });
  if (!response.ok || !response.body) throw new Error('Bild nicht erreichbar.');
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(type)) throw new Error('Bildformat nicht unterstützt.');
  if (Number(response.headers.get('content-length')) > MAX_DOWNLOAD_BYTES) throw new Error('Originalbild größer als 4 MB.');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value: chunk} = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > MAX_DOWNLOAD_BYTES) throw new Error('Originalbild größer als 4 MB.');
      chunks.push(chunk);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  combined.throwIfAborted();
  const objectUrl = URL.createObjectURL(new Blob(chunks, {type}));
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => { img.onload = img.onerror = null; combined.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(new Error('Zeitlimit beim Bildladen.')); };
      img.onload = () => { cleanup(); resolve(); };
      img.onerror = () => { cleanup(); reject(new Error('Bild kann nicht gelesen werden.')); };
      combined.addEventListener('abort', abort, {once:true});
      if (combined.aborted) return abort();
      img.src = objectUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 32 * 1024 * 1024) throw new Error('Bildabmessungen nicht unterstützt.');
    const canvas = document.createElement('canvas');
    for (const edge of edges) {
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/png');
      if (result.startsWith('data:image/png;base64,') && atob(result.split(',')[1]).length <= maxBytes) return result;
    }
    throw new Error('Bild lässt sich nicht ausreichend verkleinern.');
  } finally { img.src = ''; URL.revokeObjectURL(objectUrl); }
}

/** Nur die beiden Referenzen des bereits autorisierten Actors, keine Ordnersuche. */
export async function attachImages(data, actor, { load = loadOfflineImage } = {}) {
  const images = { portrait: null, token: null };
  const cache = new Map();
  for (const [key, value] of [['portrait', actor.img], ['token', actor.prototypeToken?.texture?.src]]) {
    if (!value) continue;
    if (typeof value !== 'string') throw new Error('Ungültige Bildreferenz.');
    if (key === 'token' && (actor.prototypeToken?.randomImg || value.includes('*'))) {
      data.warnings.push('Zufälliger Token: keine Bildvariante ausgewählt; Tokenbild nicht exportiert.');
      continue;
    }
    try {
      if (!cache.has(value)) cache.set(value, await load(value));
      images[key] = cache.get(value);
    } catch {
      throw new Error(`${(data.monster ?? data.character).name}: ${key === 'portrait' ? 'Porträt' : 'Tokenbild'} konnte nicht übernommen werden. Bildzugriff, Format und Größe (maximal 4 MB) prüfen. Der bisherige Archivstand bleibt erhalten.`);
    }
  }
  return { ...data, schemaVersion: '1.2.0', images };
}
