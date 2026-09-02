import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { Modal } from "../../components/Modal";
import type { AWSCredential, Bucket } from "../../types";

export default function AdminBuckets() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [credentials, setCredentials] = useState<AWSCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

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
    if (!window.confirm(`Remove bucket "${bucket.name}" from estri? (This does not delete it in S3.)`))
      return;
    try {
      await api.adminDeleteBucket(bucket.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove bucket");
    }
  };

  const credentialName = (id: string) => credentials.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Buckets</h1>
          <p className="text-sm text-slate-500">
            Registry of S3 buckets estri can browse, each bound to a credential profile.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={credentials.length === 0}
          className="btn-primary"
          title={credentials.length === 0 ? "Create a credential first" : undefined}
        >
          Register bucket
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">Bucket</th>
                <th className="px-4 py-2.5 font-medium">Region</th>
                <th className="px-4 py-2.5 font-medium">Credential</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{b.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{b.region}</td>
                  <td className="px-4 py-2.5 text-slate-500">{credentialName(b.credentialId)}</td>
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
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
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
          onCreated={load}
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Bucket name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Region</label>
          <input required value={region} onChange={(e) => setRegion(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Credential profile</label>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
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
