import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { CheckIcon, KeyIcon, SpinnerIcon, WarningIcon } from "../../components/icons";
import type { AWSAuthMethod, AWSCredential } from "../../types";

const AUTH_METHOD_LABELS: Record<AWSAuthMethod, string> = {
  irsa: "Kubernetes ServiceAccount (IRSA / Pod Identity)",
  assume_role: "AWS Assume Role",
  static_keys: "Static Access Key / Secret Key",
};

const AUTH_METHOD_BADGE: Record<AWSAuthMethod, string> = {
  irsa: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  assume_role: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  static_keys: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

type TestState =
  | { status: "testing" }
  | { status: "success"; account: string; arn: string }
  | { status: "error"; message: string };

export default function AdminCredentials() {
  const [credentials, setCredentials] = useState<AWSCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AWSCredential | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestState>>({});
  const toast = useToast();
  const confirm = useConfirm();

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
    const ok = await confirm({
      title: `Delete credential "${cred.name}"?`,
      description: "Any bucket still bound to it must be reassigned first.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.adminDeleteCredential(cred.id);
      toast.success(`Deleted ${cred.name}`);
      load();
    } catch (err) {
      toast.error("Failed to delete credential", err instanceof Error ? err.message : undefined);
    }
  };

  const testConnection = async (cred: AWSCredential) => {
    setTestResults((prev) => ({ ...prev, [cred.id]: { status: "testing" } }));
    try {
      const res = await api.adminTestCredential(cred.id);
      setTestResults((prev) => ({
        ...prev,
        [cred.id]: { status: "success", account: res.account, arn: res.arn },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [cred.id]: {
          status: "error",
          message: err instanceof Error ? err.message : "Test failed",
        },
      }));
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        icon={<KeyIcon className="h-5 w-5" />}
        title="AWS Credentials"
        description="Admin-only. Connection profiles used to reach S3 — IRSA, Assume Role, or static access keys (encrypted at rest)."
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            New credential
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card space-y-3 p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {credentials.map((cred) => (
            <div key={cred.id} className="card p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-display font-semibold text-paper-800 dark:text-paper-100">
                  {cred.name}
                </h3>
                {cred.isDefault && (
                  <span className="shrink-0 rounded-full bg-ember-50 px-2 py-0.5 text-xs font-medium text-ember-600 dark:bg-ember-950 dark:text-ember-400">
                    Default
                  </span>
                )}
              </div>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${AUTH_METHOD_BADGE[cred.authMethod]}`}
              >
                {AUTH_METHOD_LABELS[cred.authMethod]}
              </span>
              <dl className="mt-3 space-y-1 font-mono text-xs text-paper-600 dark:text-paper-400">
                <div className="flex justify-between">
                  <dt className="text-paper-400">region</dt>
                  <dd>{cred.region}</dd>
                </div>
                {cred.authMethod === "assume_role" && (
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-paper-400">role_arn</dt>
                    <dd className="truncate text-right">{cred.roleArn}</dd>
                  </div>
                )}
                {cred.authMethod === "static_keys" && (
                  <div className="flex justify-between">
                    <dt className="text-paper-400">access_key</dt>
                    <dd>{cred.hasStaticKeys ? "•••••••• (set)" : "not set"}</dd>
                  </div>
                )}
              </dl>

              {(() => {
                const result = testResults[cred.id];
                if (result?.status === "success") {
                  return (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Connected as account {result.account}</p>
                        <p className="mt-0.5 truncate font-mono opacity-80">{result.arn}</p>
                      </div>
                    </div>
                  );
                }
                if (result?.status === "error") {
                  return (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                      <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{result.message}</span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="mt-3 flex items-center gap-3 border-t border-paper-100 pt-3 dark:border-paper-800">
                <button
                  onClick={() => testConnection(cred)}
                  disabled={testResults[cred.id]?.status === "testing"}
                  className="flex items-center gap-1.5 text-sm font-medium text-paper-600 hover:underline disabled:opacity-60 dark:text-paper-300"
                >
                  {testResults[cred.id]?.status === "testing" && (
                    <SpinnerIcon className="h-3.5 w-3.5" />
                  )}
                  {testResults[cred.id]?.status === "testing" ? "Testing…" : "Test connection"}
                </button>
                <button
                  onClick={() => setEditing(cred)}
                  className="text-sm font-medium text-ember-600 hover:underline dark:text-ember-400"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(cred)}
                  className="ml-auto text-sm font-medium text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {credentials.length === 0 && (
            <p className="text-sm text-paper-400">No credentials configured yet.</p>
          )}
        </div>
      )}

      {showCreate && (
        <CredentialForm
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            load();
            toast.success("Credential created");
          }}
        />
      )}
      {editing && (
        <CredentialForm
          credential={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
            toast.success("Credential updated");
          }}
        />
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
                className="input font-mono text-xs"
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
            <p className="text-xs text-paper-400">
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
                className="input font-mono text-xs"
              />
            </Field>
            <Field label={isEdit ? "Secret key (leave blank to keep)" : "Secret key"}>
              <input
                required={!isEdit}
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                className="input font-mono text-xs"
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
                className="input font-mono text-xs"
              />
            </Field>
            <Field label="Base secret key (optional)">
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                className="input font-mono text-xs"
              />
            </Field>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-paper-700 dark:text-paper-200">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Set as default credential
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
      <label className="mb-1.5 block text-sm font-medium text-paper-700 dark:text-paper-300">
        {label}
      </label>
      {children}
    </div>
  );
}
