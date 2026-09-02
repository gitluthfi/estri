import React, { useState } from "react";
import { Modal } from "./Modal";
import { uploadFile } from "../api/endpoints";
import { UploadIcon } from "./icons";

interface FileProgress {
  file: File;
  progress: number;
  error?: string;
  done?: boolean;
}

export function UploadModal({
  bucket,
  prefix,
  onClose,
  onUploaded,
}: {
  bucket: string;
  prefix: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [items, setItems] = useState<FileProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const startUploads = async (list: FileProgress[]) => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      try {
        await uploadFile(bucket, prefix, item.file, (pct) => {
          setItems((prev) =>
            prev.map((it) => (it.file === item.file ? { ...it, progress: pct } : it)),
          );
        });
        setItems((prev) =>
          prev.map((it) => (it.file === item.file ? { ...it, progress: 100, done: true } : it)),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.file === item.file
              ? { ...it, error: err instanceof Error ? err.message : "Upload failed" }
              : it,
          ),
        );
      }
    }
    onUploaded();
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map((file) => ({ file, progress: 0 }));
    setItems((prev) => [...prev, ...newItems]);
    startUploads(newItems);
  };

  return (
    <Modal title="Upload files" onClose={onClose}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-slate-200"
        }`}
      >
        <UploadIcon className="mb-2 text-slate-400" />
        <p className="text-sm text-slate-500">
          Drag & drop files here, or{" "}
          <label className="cursor-pointer font-medium text-brand-600 hover:underline">
            browse
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-slate-400">Uploading to /{prefix || ""}</p>
      </div>

      {items.length > 0 && (
        <div className="mt-4 max-h-48 space-y-2 overflow-auto">
          {items.map((item, i) => (
            <div key={i} className="text-sm">
              <div className="flex justify-between">
                <span className="truncate text-slate-700">{item.file.name}</span>
                <span className="ml-2 shrink-0 text-slate-400">
                  {item.error ? "Failed" : item.done ? "Done" : `${item.progress}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.error ? "bg-red-500" : "bg-brand-500"
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.error && <p className="mt-0.5 text-xs text-red-500">{item.error}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
