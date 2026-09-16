import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';

const MANIFEST_NAME = 'manifest.json';

// Bundles every History entry (PDF + page images + metadata) into a single
// .zip file, so the whole thing can be saved/shared as one file and restored
// later - even onto a different device. Runs sequentially (not Promise.all)
// since each entry's files can be a few MB - reading them all into memory at
// once would spike memory on a large history.
export async function createHistoryBackup(history) {
  const zip = new JSZip();
  const manifest = [];

  for (const entry of history) {
    const entryDir = `${entry.id}/`;
    const pdfBase64 = await FileSystem.readAsStringAsync(entry.pdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const pdfPath = `${entryDir}document.pdf`;
    zip.file(pdfPath, pdfBase64, { base64: true });

    const pagePaths = [];
    for (let i = 0; i < entry.pageUris.length; i++) {
      const pageBase64 = await FileSystem.readAsStringAsync(entry.pageUris[i], {
        encoding: FileSystem.EncodingType.Base64,
      });
      const pagePath = `${entryDir}page-${i}.jpg`;
      zip.file(pagePath, pageBase64, { base64: true });
      pagePaths.push(pagePath);
    }

    manifest.push({
      id: entry.id,
      name: entry.name,
      createdAt: entry.createdAt,
      pageCount: entry.pageCount,
      pdfPath,
      pagePaths,
    });
  }

  zip.file(MANIFEST_NAME, JSON.stringify(manifest));

  return zip.generateAsync({ type: 'base64' });
}

// Reads a backup .zip (from createHistoryBackup) and extracts it into fresh
// local files, ready to hand to HistoryContext.addEntry - it never touches
// HistoryContext itself, so the caller decides how (and whether) to merge
// restored entries with what's already there.
export async function readHistoryBackup(zipUri, cachePrefix) {
  const zipBase64 = await FileSystem.readAsStringAsync(zipUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(zipBase64, { base64: true });

  const manifestFile = zip.file(MANIFEST_NAME);
  if (!manifestFile) {
    throw new Error('This file is not a valid Pro Scanner backup.');
  }
  const manifest = JSON.parse(await manifestFile.async('string'));

  const restored = [];
  for (const item of manifest) {
    const pdfFile = zip.file(item.pdfPath);
    if (!pdfFile) continue;
    const pdfBase64 = await pdfFile.async('base64');
    const pdfUri = `${FileSystem.cacheDirectory}${cachePrefix}-${item.id}-document.pdf`;
    await FileSystem.writeAsStringAsync(pdfUri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });

    const pageUris = [];
    for (let i = 0; i < item.pagePaths.length; i++) {
      const pageFile = zip.file(item.pagePaths[i]);
      if (!pageFile) continue;
      const pageBase64 = await pageFile.async('base64');
      const pageUri = `${FileSystem.cacheDirectory}${cachePrefix}-${item.id}-page-${i}.jpg`;
      await FileSystem.writeAsStringAsync(pageUri, pageBase64, { encoding: FileSystem.EncodingType.Base64 });
      pageUris.push(pageUri);
    }

    restored.push({
      name: item.name,
      createdAt: item.createdAt,
      pdfUri,
      pageUris,
    });
  }

  return restored;
}
