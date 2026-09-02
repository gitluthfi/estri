import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { Modal } from "../../components/Modal";
import type { Bucket, Role, User } from "../../types";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [permTarget, setPermTarget] = useState<User | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.adminListUsers(), api.adminListBuckets()])
      .then(([u, b]) => {
        setUsers(u);
        setBuckets(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleActive = async (user: User) => {
    await api.adminUpdateUser(user.id, { active: !user.active });
    load();
  };

  const changeRole = async (user: User, role: Role) => {
    await api.adminUpdateUser(user.id, { role });
    load();
  };

  const remove = async (user: User) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    try {
      await api.adminDeleteUser(user.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage accounts and role-based access.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New user
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
                <th className="px-4 py-2.5 font-medium">Username</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{u.username}</td>
                  <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="admin">admin</option>
                      <option value="dev">dev</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.active
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {u.role === "dev" && (
                      <button
                        onClick={() => setPermTarget(u)}
                        className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                      >
                        Bucket access
                      </button>
                    )}
                    <button
                      onClick={() => remove(u)}
                      className="text-sm font-medium text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {permTarget && (
        <PermissionsModal
          user={permTarget}
          buckets={buckets}
          onClose={() => setPermTarget(null)}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("dev");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.adminCreateUser({ username, email, password, role });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New user" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Username">
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Password">
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            <option value="dev">dev</option>
            <option value="admin">admin</option>
          </select>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
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

function PermissionsModal({
  user,
  buckets,
  onClose,
}: {
  user: User;
  buckets: Bucket[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [canWrite, setCanWrite] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .adminGetUserPermissions(user.id)
      .then((perms) => {
        setSelected(new Set(perms.map((p) => p.bucketId)));
        if (perms.length > 0) {
          setCanWrite(perms[0].canWrite);
          setCanDelete(perms[0].canDelete);
        }
      })
      .finally(() => setLoading(false));
  }, [user.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api.adminSetUserPermissions(user.id, {
        bucketIds: Array.from(selected),
        canWrite,
        canDelete,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Bucket access — ${user.username}`} onClose={onClose} wide>
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
            {buckets.length === 0 && (
              <p className="p-2 text-sm text-slate-400">No buckets registered yet.</p>
            )}
            {buckets.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={() => toggle(b.id)}
                />
                <span className="font-medium text-slate-700">{b.name}</span>
                <span className="text-xs text-slate-400">({b.region})</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} />
              Can upload / write
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={canDelete}
                onChange={(e) => setCanDelete(e.target.checked)}
              />
              Can delete
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} disabled={submitting} className="btn-primary">
              Save
            </button>
          </div>
        </>
      )}
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
