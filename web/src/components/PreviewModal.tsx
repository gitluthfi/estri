import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { previewUrl } from "../api/endpoints";
import { previewKind } from "../utils/format";
import type { ObjectEntry } from "../types";
import { api } from "../api/client";

export function PreviewModal({
  bucket,
  entry,
  onClose,
}: {
  bucket: string;
  entry: ObjectEntry;
  onClose: () => void;
}) {
  const kind = previewKind(entry.name);
  const url = previewUrl(bucket, entry.key);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "text") return;
    api
      .get(url, { responseType: "text" })
      .then((res) => setText(res.data))
      .catch(() => setError("Failed to load preview"));
  }, [kind, url]);

  return (
    <Modal title={entry.name} onClose={onClose} wide>
      {kind === "image" && (
        <img src={url} alt={entry.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
      )}
      {kind === "pdf" && (
        <iframe title={entry.name} src={url} className="h-[70vh] w-full rounded-lg border border-slate-200" />
      )}
      {kind === "text" && (
        <pre className="max-h-[70vh] overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          {error ?? text ?? "Loading…"}
        </pre>
      )}
      {kind === null && (
        <p className="py-8 text-center text-sm text-slate-500">
          No inline preview available for this file type. Use Download instead.
        </p>
      )}
    </Modal>
  );
}
