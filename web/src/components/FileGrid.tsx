import React from "react";
import type { ObjectEntry } from "../types";
import { formatBytes, fileKind, FILE_KIND_COLOR } from "../utils/format";
import {
  ArchiveFileIcon,
  CodeFileIcon,
  DocFileIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  ImageFileIcon,
  TrashIcon,
} from "./icons";

function TypeIcon({ name }: { name: string }) {
  const kind = fileKind(name);
  const Icon = {
    image: ImageFileIcon,
    archive: ArchiveFileIcon,
    doc: DocFileIcon,
    code: CodeFileIcon,
    other: FileIcon,
  }[kind];
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${FILE_KIND_COLOR[kind]}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function FileGrid({
  entries,
  onOpenFolder,
  onDownload,
  onDelete,
  onPreview,
  canDelete,
}: {
  entries: ObjectEntry[];
  onOpenFolder: (key: string) => void;
  onDownload: (entry: ObjectEntry) => void;
  onDelete: (entry: ObjectEntry) => void;
  onPreview: (entry: ObjectEntry) => void;
  canDelete: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paper-100 text-paper-300 dark:bg-paper-800 dark:text-paper-600">
          <FolderIcon className="h-7 w-7" />
        </div>
        <p className="mt-4 text-sm font-medium text-paper-600 dark:text-paper-300">
          This folder is empty
        </p>
        <p className="mt-1 text-xs text-paper-400 dark:text-paper-500">
          Drag files anywhere onto this page, or use the Upload button above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="group relative flex flex-col items-center rounded-xl border border-paper-100 p-4 text-center transition-colors hover:border-paper-200 hover:bg-paper-50 dark:border-paper-800 dark:hover:border-paper-700 dark:hover:bg-paper-800/60"
        >
          <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100">
            {!entry.isFolder && (
              <button
                title="Download"
                onClick={() => onDownload(entry)}
                className="rounded p-1 text-paper-400 hover:bg-paper-200 hover:text-paper-800 dark:hover:bg-paper-700 dark:hover:text-paper-100"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                title="Delete"
                onClick={() => onDelete(entry)}
                className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {entry.isFolder ? (
            <button
              onClick={() => onOpenFolder(entry.key)}
              className="flex flex-col items-center gap-2"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-50 text-ember-500 dark:bg-ember-950 dark:text-ember-400">
                <FolderIcon className="h-5 w-5" />
              </span>
              <span className="line-clamp-2 break-all text-xs font-medium text-paper-800 dark:text-paper-100">
                {entry.name}
              </span>
            </button>
          ) : (
            <button onClick={() => onPreview(entry)} className="flex flex-col items-center gap-2">
              <TypeIcon name={entry.name} />
              <span className="line-clamp-2 break-all text-xs font-medium text-paper-700 dark:text-paper-200">
                {entry.name}
              </span>
              <span className="font-mono text-[10px] text-paper-400 dark:text-paper-500">
                {formatBytes(entry.size)}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
