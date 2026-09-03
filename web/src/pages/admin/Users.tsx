import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { UsersIcon } from "../../components/icons";
import type { Bucket, Role, User } from "../../types";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [permTarget, setPermTarget] = useState<User | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

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
    try {
      await api.adminUpdateUser(user.id, { active: !user.active });
      load();
    } catch (err) {
      toast.error("Failed to update user", err instanceof Error ? err.message : undefined);
    }
  };

  const changeRole = async (user: User, role: Role) => {
    try {
      await api.adminUpdateUser(user.id, { role });
      load();
    } catch (err) {
      toast.error("Failed to update role", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (user: User) => {
    const ok = await confirm({
      title: `Delete user "${user.username}"?`,
      description: "They will immediately lose access to estri.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.adminDeleteUser(user.id);
      toast.success(`Removed ${user.username}`);
      load();
    } catch (err) {
      toast.error("Failed to delete user", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        icon={<UsersIcon className="h-5 w-5" />}
        title="Users"
        description="Manage accounts and role-based access."
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            New user
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-xs uppercase tracking-wide text-paper-400 dark:border-paper-800 dark:text-paper-500">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-paper-100 last:border-0 dark:border-paper-800"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.username} size="sm" />
                      <div>
                        <div className="font-medium text-paper-800 dark:text-paper-100">
                          {u.username}
                        </div>
                        <div className="text-xs text-paper-400 dark:text-paper-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      className="input w-auto py-1.5"
                    >
                      <option value="admin">admin</option>
                      <option value="dev">dev</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        u.active
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-paper-100 text-paper-500 dark:bg-paper-800 dark:text-paper-400"
                      }`}
                    >
                      {u.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {u.role === "dev" && (
                      <button
                        onClick={() => setPermTarget(u)}
                        className="mr-3 text-sm font-medium text-ember-600 hover:underline dark:text-ember-400"
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
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            load();
            toast.success("User created");
          }}
        />
      )}
      {permTarget && (
        <PermissionsModal
          user={permTarget}
          buckets={buckets}
          onClose={() => setPermTarget(null)}
          onSaved={() => toast.success("Bucket access updated")}
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

function PermissionsModal({
  user,
  buckets,
  onClose,
  onSaved,
}: {
  user: User;
  buckets: Bucket[];
  onClose: () => void;
  onSaved: () => void;
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
      onSaved();
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
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-paper-200 p-2 dark:border-paper-700">
            {buckets.length === 0 && (
              <p className="p-2 text-sm text-paper-400">No buckets registered yet.</p>
            )}
            {buckets.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper-50 dark:hover:bg-paper-800"
              >
                <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} />
                <span className="font-medium text-paper-700 dark:text-paper-200">{b.name}</span>
                <span className="text-xs text-paper-400">({b.region})</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-6">
            <label className="flex items-center gap-2 text-sm text-paper-700 dark:text-paper-200">
              <input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} />
              Can upload / write
            </label>
            <label className="flex items-center gap-2 text-sm text-paper-700 dark:text-paper-200">
              <input
                type="checkbox"
                checked={canDelete}
                onChange={(e) => setCanDelete(e.target.checked)}
              />
              Can delete
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

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
      <label className="mb-1.5 block text-sm font-medium text-paper-700 dark:text-paper-300">
        {label}
      </label>
      {children}
    </div>
  );
}
