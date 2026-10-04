export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}

export function formatKB(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
