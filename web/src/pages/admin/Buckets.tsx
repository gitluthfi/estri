import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { FolderIcon } from "../../components/icons";
import type { AWSCredential, Bucket } from "../../types";

export default function AdminBuckets() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [credentials, setCredentials] = useState<AWSCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    Promise.all([api.adminListBuckets(), api.adminListCredentials()])
      .then(([b, c]) => {
        setBuckets(b);
        setCredentials(c);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (bucket: Bucket) => {
    const ok = await confirm({
      title: `Remove bucket "${bucket.name}" from estri?`,
      description: "This only removes estri's registration — nothing is deleted in S3 itself.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.adminDeleteBucket(bucket.id);
      toast.success(`Removed ${bucket.name}`);
      load();
    } catch (err) {
      toast.error("Failed to remove bucket", err instanceof Error ? err.message : undefined);
    }
  };

  const credentialName = (id: string) => credentials.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="p-6">
      <PageHeader
        icon={<FolderIcon className="h-5 w-5" />}
        title="Buckets"
        description="Registry of S3 buckets estri can browse, each bound to a credential profile."
        action={
          <button
            onClick={() => setShowCreate(true)}
            disabled={credentials.length === 0}
            className="btn-primary"
            title={credentials.length === 0 ? "Create a credential first" : undefined}
          >
            Register bucket
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-xs uppercase tracking-wide text-paper-400 dark:border-paper-800 dark:text-paper-500">
                <th className="px-4 py-2.5 font-medium">Bucket</th>
                <th className="px-4 py-2.5 font-medium">Region</th>
                <th className="px-4 py-2.5 font-medium">Credential</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-paper-100 last:border-0 dark:border-paper-800"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5 font-medium text-paper-800 dark:text-paper-100">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ember-50 text-ember-500 dark:bg-ember-950 dark:text-ember-400">
                        <FolderIcon className="h-4 w-4" />
                      </span>
                      {b.name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-paper-500 dark:text-paper-400">
                    {b.region}
                  </td>
                  <td className="px-4 py-2.5 text-paper-500 dark:text-paper-400">
                    {credentialName(b.credentialId)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => remove(b)}
                      className="text-sm font-medium text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {buckets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-paper-400">
                    No buckets registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateBucketModal
          credentials={credentials}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            load();
            toast.success("Bucket registered");
          }}
        />
      )}
    </div>
  );
}

function CreateBucketModal({
  credentials,
  onClose,
  onCreated,
}: {
  credentials: AWSCredential[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [credentialId, setCredentialId] = useState(credentials[0]?.id ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.adminCreateBucket({ name, region, credentialId });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register bucket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Register bucket" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-paper-700 dark:text-paper-300">
            Bucket name
          </label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-paper-700 dark:text-paper-300">
            Region
          </label>
          <input required value={region} onChange={(e) => setRegion(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-paper-700 dark:text-paper-300">
            Credential profile
          </label>
          <select
            required
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            className="input"
          >
            {credentials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.authMethod})
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            Register
          </button>
        </div>
      </form>
    </Modal>
  );
}
