import React from "react";
import type { ObjectEntry } from "../types";
import { formatBytes, formatDate } from "../utils/format";
import { DownloadIcon, EyeIcon, FileIcon, FolderIcon, TrashIcon } from "./icons";

export function FileTable({
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
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-slate-400">
        This folder is empty.
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
          <th className="px-4 py-2 font-medium">Name</th>
          <th className="px-4 py-2 font-medium">Size</th>
          <th className="px-4 py-2 font-medium">Last modified</th>
          <th className="px-4 py-2 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.key}
            className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"
          >
            <td className="px-4 py-2.5">
              {entry.isFolder ? (
                <button
                  onClick={() => onOpenFolder(entry.key)}
                  className="flex items-center gap-2 font-medium text-slate-800 hover:text-brand-600"
                >
                  <FolderIcon className="shrink-0 text-amber-500" />
                  {entry.name}
                </button>
              ) : (
                <span className="flex items-center gap-2 text-slate-700">
                  <FileIcon className="shrink-0 text-slate-400" />
                  {entry.name}
                </span>
              )}
            </td>
            <td className="px-4 py-2.5 text-slate-500">
              {entry.isFolder ? "—" : formatBytes(entry.size)}
            </td>
            <td className="px-4 py-2.5 text-slate-500">
              {entry.isFolder ? "—" : formatDate(entry.lastModified)}
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                {!entry.isFolder && (
                  <>
                    <button
                      title="Preview"
                      onClick={() => onPreview(entry)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    >
                      <EyeIcon />
                    </button>
                    <button
                      title="Download"
                      onClick={() => onDownload(entry)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    >
                      <DownloadIcon />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    title="Delete"
                    onClick={() => onDelete(entry)}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <TrashIcon />
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
