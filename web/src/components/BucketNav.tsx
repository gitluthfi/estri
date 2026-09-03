import React from "react";
import type { AccessibleBucket } from "../types";
import { ChevronUpDownIcon } from "./icons";

// Bucket switcher + breadcrumb, merged into one line: the bucket name IS
// the root crumb, and doubles as a dropdown to switch buckets (a real
// <select> transparently overlaid on the styled label, so it stays a
// native, accessible control). One compact row instead of two stacked bars.
export function BucketNav({
  buckets,
  current,
  prefix,
  onBucketChange,
  onNavigate,
}: {
  buckets: AccessibleBucket[];
  current: string | null;
  prefix: string;
  onBucketChange: (bucketName: string) => void;
  onNavigate: (prefix: string) => void;
}) {
  const parts = prefix.split("/").filter(Boolean);

  if (buckets.length === 0) {
    return <span className="text-sm text-paper-400 dark:text-paper-500">No buckets available to you yet.</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-sm">
      <div className="relative inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-paper-800 hover:bg-paper-100 dark:text-paper-100 dark:hover:bg-paper-800">
        <span>{current}</span>
        <ChevronUpDownIcon className="h-3 w-3 text-paper-400" />
        <select
          value={current ?? ""}
          onChange={(e) => onBucketChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          aria-label="Switch bucket"
        >
          {buckets.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name} ({b.region})
            </option>
          ))}
        </select>
      </div>

      {parts.map((part, i) => {
        const path = parts.slice(0, i + 1).join("/") + "/";
        return (
          <React.Fragment key={path}>
            <span className="text-paper-300 dark:text-paper-600">/</span>
            <button
              onClick={() => onNavigate(path)}
              className="rounded px-1.5 py-0.5 text-paper-500 hover:bg-paper-100 hover:text-paper-900 dark:text-paper-400 dark:hover:bg-paper-800 dark:hover:text-paper-100"
            >
              {part}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
