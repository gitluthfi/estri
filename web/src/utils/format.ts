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

export type FileKind = "image" | "archive" | "doc" | "code" | "other";

const ARCHIVE_RE = /\.(zip|tar|gz|tgz|rar|7z|bz2)$/i;
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv)$/i;
const CODE_RE = /\.(js|jsx|ts|tsx|go|py|rb|java|c|cpp|h|rs|sh|yml|yaml|json|toml|sql|html|css)$/i;

export function fileKind(name: string): FileKind {
  if (PREVIEWABLE_IMAGE.test(name)) return "image";
  if (ARCHIVE_RE.test(name)) return "archive";
  if (CODE_RE.test(name)) return "code";
  if (DOC_RE.test(name)) return "doc";
  return "other";
}

// Tailwind classes per file kind — gives the file table visual texture
// without relying on a single brand color for everything.
export const FILE_KIND_COLOR: Record<FileKind, string> = {
  image: "text-violet-500 bg-violet-50 dark:bg-violet-950 dark:text-violet-400",
  archive: "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
  doc: "text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-400",
  code: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400",
  other: "text-paper-500 bg-paper-100 dark:bg-paper-800 dark:text-paper-400",
};

// Deterministic color pick (for avatars, bucket chips, etc.) from a string,
// so the same name always maps to the same accent.
const AVATAR_PALETTE = [
  "bg-ember-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-teal-500",
];

// Colors an audit log action badge by what kind of action it is (create,
// update, delete, read, auth) rather than which resource it touched — keeps
// the audit log scannable without a hardcoded label per action string.
export function actionBadgeColor(action: string): string {
  if (action === "login" || action === "logout") {
    return "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  }
  if (action.endsWith(".delete")) {
    return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  }
  if (action.endsWith(".create")) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (action.endsWith(".update") || action.endsWith(".set")) {
    return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
  if (action.endsWith(".upload") || action.endsWith(".download")) {
    return "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
  }
  return "bg-paper-100 text-paper-600 dark:bg-paper-800 dark:text-paper-300";
}

export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
