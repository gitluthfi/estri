import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as api from "../api/endpoints";
import type { AccessibleBucket, ObjectEntry } from "../types";
import { BucketSwitcher } from "../components/BucketSwitcher";
import { Breadcrumb } from "../components/Breadcrumb";
import { FileTable } from "../components/FileTable";
import { UploadModal } from "../components/UploadModal";
import { NewFolderModal } from "../components/NewFolderModal";
import { PreviewModal } from "../components/PreviewModal";
import { FolderPlusIcon, SearchIcon, UploadIcon } from "../components/icons";

export default function Browser() {
  const [buckets, setBuckets] = useState<AccessibleBucket[]>([]);
  const [params, setParams] = useSearchParams();
  const bucketName = params.get("bucket");
  const prefix = params.get("prefix") ?? "";

  const [entries, setEntries] = useState<ObjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<ObjectEntry | null>(null);

  const currentBucket = useMemo(
    () => buckets.find((b) => b.name === bucketName) ?? null,
    [buckets, bucketName],
  );

  useEffect(() => {
    api.listAccessibleBuckets().then((list) => {
      setBuckets(list);
      if (!bucketName && list.length > 0) {
        setParams({ bucket: list[0].name, prefix: "" }, { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    if (!bucketName) return;
    setLoading(true);
    setError("");
    setSearchActive(false);
    api
      .listObjects(bucketName, prefix)
      .then((res) => setEntries(res.entries ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [bucketName, prefix]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBucketChange = (name: string) => {
    setParams({ bucket: name, prefix: "" });
    setSearchQuery("");
  };

  const handleNavigate = (newPrefix: string) => {
    setParams({ bucket: bucketName ?? "", prefix: newPrefix });
    setSearchQuery("");
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketName || !searchQuery.trim()) {
      setSearchActive(false);
      refresh();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.searchObjects(bucketName, searchQuery.trim(), prefix);
      setEntries(res.entries ?? []);
      setSearchActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (entry: ObjectEntry) => {
    if (!bucketName) return;
    try {
      const { url } = await api.getDownloadUrl(bucketName, entry.key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const handleDelete = async (entry: ObjectEntry) => {
    if (!bucketName) return;
    const label = entry.isFolder ? `folder "${entry.name}" and everything inside it` : `"${entry.name}"`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await api.deleteObject(bucketName, entry.key);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <BucketSwitcher buckets={buckets} current={bucketName} onChange={handleBucketChange} />

        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files in this bucket…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          {currentBucket?.canWrite && (
            <>
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <FolderPlusIcon className="h-4 w-4" /> New folder
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <UploadIcon className="h-4 w-4" /> Upload
              </button>
            </>
          )}
        </div>
      </header>

      <div className="border-b border-slate-100 bg-white px-6 py-3">
        {bucketName ? (
          <Breadcrumb bucket={bucketName} prefix={prefix} onNavigate={handleNavigate} />
        ) : (
          <span className="text-sm text-slate-400">Select a bucket to get started.</span>
        )}
        {searchActive && (
          <span className="ml-3 text-xs font-medium text-brand-600">
            Showing search results for "{searchQuery}"
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}
        {loading ? (
          <div className="flex justify-center py-24 text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <FileTable
              entries={entries}
              onOpenFolder={handleNavigate}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={setPreviewEntry}
              canDelete={currentBucket?.canDelete ?? false}
            />
          </div>
        )}
      </div>

      {showUpload && bucketName && (
        <UploadModal
          bucket={bucketName}
          prefix={prefix}
          onClose={() => setShowUpload(false)}
          onUploaded={refresh}
        />
      )}
      {showNewFolder && bucketName && (
        <NewFolderModal
          bucket={bucketName}
          prefix={prefix}
          onClose={() => setShowNewFolder(false)}
          onCreated={refresh}
        />
      )}
      {previewEntry && bucketName && (
        <PreviewModal bucket={bucketName} entry={previewEntry} onClose={() => setPreviewEntry(null)} />
      )}
    </div>
  );
}
