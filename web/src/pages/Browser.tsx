import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as api from "../api/endpoints";
import type { AccessibleBucket, ObjectEntry } from "../types";
import { BucketNav } from "../components/BucketNav";
import { FileTable, type SortKey } from "../components/FileTable";
import { FileGrid } from "../components/FileGrid";
import { UploadModal } from "../components/UploadModal";
import { NewFolderModal } from "../components/NewFolderModal";
import { PreviewModal } from "../components/PreviewModal";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { uploadFile } from "../api/endpoints";
import {
  CloseIcon,
  FolderPlusIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  UploadIcon,
} from "../components/icons";

export default function Browser() {
  const [buckets, setBuckets] = useState<AccessibleBucket[]>([]);
  const [params, setParams] = useSearchParams();
  const bucketName = params.get("bucket");
  const prefix = params.get("prefix") ?? "";
  const toast = useToast();
  const confirm = useConfirm();

  const [entries, setEntries] = useState<ObjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"list" | "grid">(
    () => (localStorage.getItem("estri-view") as "list" | "grid") ?? "list",
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<ObjectEntry | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = React.useRef(0);

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

  const setView_ = (v: "list" | "grid") => {
    setView(v);
    localStorage.setItem("estri-view", v);
  };

  const refresh = useCallback(() => {
    if (!bucketName) {
      setLoading(false);
      return;
    }
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

  const sortedEntries = useMemo(() => {
    const folders = entries.filter((e) => e.isFolder);
    const files = entries.filter((e) => !e.isFolder);
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: ObjectEntry, b: ObjectEntry) => {
      if (sortKey === "size") return (a.size - b.size) * dir;
      if (sortKey === "modified") {
        return ((a.lastModified ?? "") > (b.lastModified ?? "") ? 1 : -1) * dir;
      }
      return a.name.localeCompare(b.name) * dir;
    };
    return [...folders.sort(cmp), ...files.sort(cmp)];
  }, [entries, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleBucketChange = (name: string) => {
    setParams({ bucket: name, prefix: "" });
    closeSearch();
  };

  const handleNavigate = (newPrefix: string) => {
    setParams({ bucket: bucketName ?? "", prefix: newPrefix });
    closeSearch();
  };

  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    if (searchActive) refresh();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketName || !searchQuery.trim()) return;
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
      toast.error("Download failed", err instanceof Error ? err.message : undefined);
    }
  };

  const handleDelete = async (entry: ObjectEntry) => {
    if (!bucketName) return;
    const label = entry.isFolder ? `folder "${entry.name}" and everything inside it` : `"${entry.name}"`;
    const ok = await confirm({
      title: `Delete ${label}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteObject(bucketName, entry.key);
      toast.success(`Deleted ${entry.name}`);
      refresh();
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : undefined);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    dragCounter.current = 0;
    if (!bucketName || !currentBucket?.canWrite) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    toast.info(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);
    let failed = 0;
    for (const file of files) {
      try {
        await uploadFile(bucketName, prefix, file);
      } catch {
        failed++;
      }
    }
    if (failed === 0) toast.success("Upload complete");
    else toast.error(`${failed} of ${files.length} files failed to upload`);
    refresh();
  };

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current++;
        if (currentBucket?.canWrite) setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounter.current--;
        if (dragCounter.current <= 0) setDragActive(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-4 border-dashed border-ember-400 bg-ember-50/90 dark:bg-ember-950/80">
          <div className="flex flex-col items-center gap-2 text-ember-700 dark:text-ember-300">
            <UploadIcon className="h-8 w-8" />
            <p className="text-sm font-medium">Drop to upload to /{prefix || ""}</p>
          </div>
        </div>
      )}

      <header className="flex items-center gap-2 border-b border-paper-200 bg-white px-6 py-3.5 dark:border-paper-800 dark:bg-paper-900">
        <div className="min-w-0 flex-1">
          {bucketName ? (
            <BucketNav
              buckets={buckets}
              current={bucketName}
              prefix={prefix}
              onBucketChange={handleBucketChange}
              onNavigate={handleNavigate}
            />
          ) : (
            <span className="text-sm text-paper-400">No buckets available to you yet.</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="relative w-64">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-paper-400" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                onBlur={() => !searchQuery && !searchActive && setSearchOpen(false)}
                placeholder="Search this bucket…"
                className="input h-8 py-0 pl-8 pr-7 text-sm"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-paper-400 hover:text-paper-700 dark:hover:text-paper-200"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={openSearch}
              title="Search"
              className="rounded-lg p-2 text-paper-500 transition-colors hover:bg-paper-100 dark:text-paper-400 dark:hover:bg-paper-800"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => setView_(view === "list" ? "grid" : "list")}
            title={view === "list" ? "Switch to grid view" : "Switch to list view"}
            className="rounded-lg p-2 text-paper-500 transition-colors hover:bg-paper-100 dark:text-paper-400 dark:hover:bg-paper-800"
          >
            {view === "list" ? <GridIcon className="h-4 w-4" /> : <ListIcon className="h-4 w-4" />}
          </button>

          {currentBucket?.canWrite && (
            <>
              <button
                onClick={() => setShowNewFolder(true)}
                title="New folder"
                className="rounded-lg p-2 text-paper-500 transition-colors hover:bg-paper-100 dark:text-paper-400 dark:hover:bg-paper-800"
              >
                <FolderPlusIcon className="h-4 w-4" />
              </button>
              <button onClick={() => setShowUpload(true)} className="btn-primary ml-1">
                <UploadIcon className="h-4 w-4" /> Upload
              </button>
            </>
          )}
        </div>
      </header>

      {searchActive && (
        <div className="border-b border-paper-100 bg-ember-50/50 px-6 py-2 text-xs font-medium text-ember-700 dark:border-paper-800 dark:bg-ember-950/20 dark:text-ember-400">
          Search results for "{searchQuery}" — <button onClick={closeSearch} className="underline">clear</button>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        {loading ? (
          view === "grid" ? (
            <div className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="card overflow-hidden p-4">
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-4 flex-1 max-w-xs" />
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="card overflow-hidden">
            {view === "list" ? (
              <FileTable
                entries={sortedEntries}
                onOpenFolder={handleNavigate}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onPreview={setPreviewEntry}
                canDelete={currentBucket?.canDelete ?? false}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            ) : (
              <FileGrid
                entries={sortedEntries}
                onOpenFolder={handleNavigate}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onPreview={setPreviewEntry}
                canDelete={currentBucket?.canDelete ?? false}
              />
            )}
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
