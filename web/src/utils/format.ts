export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PREVIEWABLE_IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const PREVIEWABLE_TEXT = /\.(txt|md|json|ya?ml|log|csv|xml|ini|conf|env)$/i;
const PREVIEWABLE_PDF = /\.pdf$/i;

export type PreviewKind = "image" | "text" | "pdf" | null;

export function previewKind(name: string): PreviewKind {
  if (PREVIEWABLE_IMAGE.test(name)) return "image";
  if (PREVIEWABLE_PDF.test(name)) return "pdf";
  if (PREVIEWABLE_TEXT.test(name)) return "text";
  return null;
}
