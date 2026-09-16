import { pickFile } from './pickFile';

// Thin PDF-specific wrapper over the generic pickFile() helper - kept so
// existing call sites don't need to pass the same mimeType/extension pair
// every time.
export async function pickPdfFile(cachePrefix) {
  return pickFile({ mimeType: 'application/pdf', extension: 'pdf', cachePrefix });
}
