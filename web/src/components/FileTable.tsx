import React from "react";
import type { ObjectEntry } from "../types";
import { formatBytes, formatDate, fileKind, FILE_KIND_COLOR } from "../utils/format";
import {
  ArchiveFileIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CodeFileIcon,
  DocFileIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  ImageFileIcon,
  TrashIcon,
} from "./icons";

export type SortKey = "name" | "size" | "modified";

function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const kind = fileKind(name);
  const Icon = {
    image: ImageFileIcon,
    archive: ArchiveFileIcon,
    doc: DocFileIcon,
    code: CodeFileIcon,
    other: FileIcon,
  }[kind];
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${FILE_KIND_COLOR[kind]} ${className ?? ""}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2 font-medium ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 transition-colors hover:text-paper-700 dark:hover:text-paper-200 ${
          active ? "text-paper-700 dark:text-paper-200" : ""
        }`}
      >
        {label}
        {active && (dir === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export function FileTable({
  entries,
  onOpenFolder,
  onDownload,
  onDelete,
  onPreview,
  canDelete,
  sortKey,
  sortDir,
  onSort,
}: {
  entries: ObjectEntry[];
  onOpenFolder: (key: string) => void;
  onDownload: (entry: ObjectEntry) => void;
  onDelete: (entry: ObjectEntry) => void;
  onPreview: (entry: ObjectEntry) => void;
  canDelete: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
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
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-paper-200 text-xs uppercase tracking-wide text-paper-400 dark:border-paper-800 dark:text-paper-500">
          <SortHeader label="Name" sortKey="name" active={sortKey === "name"} dir={sortDir} onSort={onSort} />
          <SortHeader label="Size" sortKey="size" active={sortKey === "size"} dir={sortDir} onSort={onSort} />
          <SortHeader
            label="Last modified"
            sortKey="modified"
            active={sortKey === "modified"}
            dir={sortDir}
            onSort={onSort}
          />
          <th className="px-4 py-2 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.key}
            className="group border-b border-paper-100 last:border-0 hover:bg-paper-50 dark:border-paper-800 dark:hover:bg-paper-800/60"
          >
            <td className="px-4 py-2.5">
              {entry.isFolder ? (
                <button
                  onClick={() => onOpenFolder(entry.key)}
                  className="flex items-center gap-2.5 font-medium text-paper-800 hover:text-ember-600 dark:text-paper-100 dark:hover:text-ember-400"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ember-50 text-ember-500 dark:bg-ember-950 dark:text-ember-400">
                    <FolderIcon className="h-4 w-4" />
                  </span>
                  {entry.name}
                </button>
              ) : (
                <span className="flex items-center gap-2.5 text-paper-700 dark:text-paper-200">
                  <FileTypeIcon name={entry.name} />
                  {entry.name}
                </span>
              )}
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-paper-500 dark:text-paper-400">
              {entry.isFolder ? "—" : formatBytes(entry.size)}
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-paper-500 dark:text-paper-400">
              {entry.isFolder ? "—" : formatDate(entry.lastModified)}
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                {!entry.isFolder && (
                  <>
                    <button
                      title="Preview"
                      onClick={() => onPreview(entry)}
                      className="rounded p-1.5 text-paper-500 hover:bg-paper-200 hover:text-paper-800 dark:text-paper-400 dark:hover:bg-paper-700 dark:hover:text-paper-100"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      title="Download"
                      onClick={() => onDownload(entry)}
                      className="rounded p-1.5 text-paper-500 hover:bg-paper-200 hover:text-paper-800 dark:text-paper-400 dark:hover:bg-paper-700 dark:hover:text-paper-100"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    title="Delete"
                    onClick={() => onDelete(entry)}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
