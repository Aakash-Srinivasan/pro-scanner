// Estimates the decoded byte size of a base64 string without writing it to
// disk first - base64 encodes 3 bytes as 4 characters, with '=' padding
// making up the remainder.
export function estimateBase64Size(base64) {
  const len = base64.length;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(Math.floor((len * 3) / 4) - padding, 0);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
