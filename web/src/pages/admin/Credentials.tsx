import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { Modal } from "../../components/Modal";
import type { AWSAuthMethod, AWSCredential } from "../../types";

const AUTH_METHOD_LABELS: Record<AWSAuthMethod, string> = {
  irsa: "Kubernetes ServiceAccount (IRSA / Pod Identity)",
  assume_role: "AWS Assume Role",
  static_keys: "Static Access Key / Secret Key",
};

export default function AdminCredentials() {
  const [credentials, setCredentials] = useState<AWSCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AWSCredential | null>(null);

  const load = () => {
    setLoading(true);
    api
      .adminListCredentials()
      .then(setCredentials)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (cred: AWSCredential) => {
    if (!window.confirm(`Delete credential "${cred.name}"?`)) return;
    try {
      await api.adminDeleteCredential(cred.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete credential");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">AWS Credentials</h1>
          <p className="text-sm text-slate-500">
            Admin-only. Connection profiles used to reach S3 — IRSA, Assume Role, or static
            access keys (encrypted at rest).
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          New credential
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {credentials.map((cred) => (
            <div key={cred.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{cred.name}</h3>
                  {cred.isDefault && (
                    <span className="mt-0.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {AUTH_METHOD_LABELS[cred.authMethod]}
              </p>
              <dl className="mt-2 space-y-1 text-sm text-slate-600">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Region</dt>
                  <dd>{cred.region}</dd>
                </div>
                {cred.authMethod === "assume_role" && (
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-slate-400">Role ARN</dt>
                    <dd className="truncate text-right">{cred.roleArn}</dd>
                  </div>
                )}
                {cred.authMethod === "static_keys" && (
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Access key</dt>
                    <dd>{cred.hasStaticKeys ? "•••••••• (set)" : "not set"}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setEditing(cred)}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(cred)}
                  className="text-sm font-medium text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {credentials.length === 0 && (
            <p className="text-sm text-slate-400">No credentials configured yet.</p>
          )}
        </div>
      )}

      {showCreate && (
        <CredentialForm onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editing && (
        <CredentialForm credential={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}

function CredentialForm({
  credential,
  onClose,
  onSaved,
}: {
  credential?: AWSCredential;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!credential;
  const [name, setName] = useState(credential?.name ?? "");
  const [authMethod, setAuthMethod] = useState<AWSAuthMethod>(credential?.authMethod ?? "irsa");
  const [region, setRegion] = useState(credential?.region ?? "us-east-1");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [roleArn, setRoleArn] = useState(credential?.roleArn ?? "");
  const [externalId, setExternalId] = useState(credential?.externalId ?? "");
  const [sessionName, setSessionName] = useState(credential?.sessionName ?? "");
  const [isDefault, setIsDefault] = useState(credential?.isDefault ?? false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (isEdit && credential) {
        await api.adminUpdateCredential(credential.id, {
          region,
          accessKey: accessKey || undefined,
          secretKey: secretKey || undefined,
          roleArn,
          externalId,
          sessionName,
          isDefault,
        });
      } else {
        await api.adminCreateCredential({
          name,
          authMethod,
          region,
          accessKey,
          secretKey,
          roleArn,
          externalId,
          sessionName,
          isDefault,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credential");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit ${credential!.name}` : "New AWS credential"} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <Field label="Name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
        )}

        <Field label="Authentication method">
          <select
            disabled={isEdit}
            value={authMethod}
            onChange={(e) => setAuthMethod(e.target.value as AWSAuthMethod)}
            className="input disabled:opacity-60"
          >
            <option value="irsa">Kubernetes ServiceAccount (IRSA / Pod Identity)</option>
            <option value="assume_role">AWS Assume Role</option>
            <option value="static_keys">Static Access Key / Secret Key</option>
          </select>
        </Field>

        <Field label="Region">
          <input required value={region} onChange={(e) => setRegion(e.target.value)} className="input" />
        </Field>

        {authMethod === "assume_role" && (
          <>
            <Field label="Role ARN">
              <input
                required
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/estri-s3-access"
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="External ID (optional)">
                <input
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Session name (optional)">
                <input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="estri-session"
                  className="input"
                />
              </Field>
            </div>
            <p className="text-xs text-slate-400">
              The base identity used to assume this role comes from the pod's IRSA identity (or
              static keys below, if also provided).
            </p>
          </>
        )}

        {authMethod === "static_keys" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={isEdit ? "Access key (leave blank to keep)" : "Access key"}>
              <input
                required={!isEdit}
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                autoComplete="off"
                className="input"
              />
            </Field>
            <Field label={isEdit ? "Secret key (leave blank to keep)" : "Secret key"}>
              <input
                required={!isEdit}
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                className="input"
              />
            </Field>
          </div>
        )}

        {authMethod === "assume_role" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Base access key (optional)">
              <input
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                autoComplete="off"
                className="input"
              />
            </Field>
            <Field label="Base secret key (optional)">
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                className="input"
              />
            </Field>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Set as default credential
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {isEdit ? "Save changes" : "Create credential"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
