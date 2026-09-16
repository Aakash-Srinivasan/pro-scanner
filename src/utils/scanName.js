// Generates a unique, human-readable default name for a new scan, e.g.
// "ProScanned_20260915_1301" - avoids every scan defaulting to the exact
// same "ProScanned" name in History and on the Home screen. `prefix` lets
// other flows (like merging scans together) reuse the same timestamp format
// under their own label instead of duplicating this logic.
export function generateScanName(date = new Date(), prefix = 'ProScanned') {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${prefix}_${y}${m}${d}_${h}${min}${s}`;
}
