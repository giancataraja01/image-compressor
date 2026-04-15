/** Format a byte count into a human-readable string (B / KB / MB / GB). */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Compute the percentage saved: `(1 - compressed / original) * 100`. */
export function savingsPercent(original: number, compressed: number): number {
  if (original <= 0) return 0;
  return (1 - compressed / original) * 100;
}

/** Format a percentage value to one decimal place with a `%` suffix. */
export function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Bytes saved: `original - compressed`. */
export function bytesSaved(original: number, compressed: number): number {
  return original - compressed;
}

/**
 * Sort comparator: biggest savings percentage first.
 * Items without a `compressedSize` (errors) sort to the end.
 */
export function sortBySavings<T extends { size: number; compressedSize?: number }>(
  a: T,
  b: T,
): number {
  const aPct = a.compressedSize != null ? savingsPercent(a.size, a.compressedSize) : -Infinity;
  const bPct = b.compressedSize != null ? savingsPercent(b.size, b.compressedSize) : -Infinity;
  return bPct - aPct;
}
