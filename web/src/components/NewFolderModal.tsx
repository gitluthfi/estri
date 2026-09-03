import React, { useState } from "react";
import { Modal } from "./Modal";
import { createFolder } from "../api/endpoints";

export function NewFolderModal({
  bucket,
  prefix,
  onClose,
  onCreated,
}: {
  bucket: string;
  prefix: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await createFolder(bucket, `${prefix}${name.trim()}`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New folder" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-paper-700 dark:text-paper-300">
            Folder name
          </label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
