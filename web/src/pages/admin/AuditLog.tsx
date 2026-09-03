import React, { useEffect, useState } from "react";
import * as api from "../../api/endpoints";
import { PageHeader } from "../../components/PageHeader";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { useToast } from "../../context/ToastContext";
import { ActivityIcon } from "../../components/icons";
import { actionBadgeColor, formatDate } from "../../utils/format";
import type { AuditLogEntry } from "../../types";

const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    api.adminListAuditActions().then(setActions).catch(() => {});
  }, []);

  const load = (filter: string) => {
    setLoading(true);
    setError("");
    api
      .adminListAuditLogs({ limit: PAGE_SIZE, offset: 0, action: filter || undefined })
      .then((res) => {
        setEntries(res.entries);
        setHasMore(res.hasMore);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(actionFilter), [actionFilter]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.adminListAuditLogs({
        limit: PAGE_SIZE,
        offset: entries.length,
        action: actionFilter || undefined,
      });
      setEntries((prev) => [...prev, ...res.entries]);
      setHasMore(res.hasMore);
    } catch (err) {
      toast.error("Failed to load more", err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        icon={<ActivityIcon className="h-5 w-5" />}
        title="Audit Log"
        description="Every login and mutating action across estri — who did what, from where, and when."
        action={
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card space-y-3 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1 max-w-md" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-paper-200 text-xs uppercase tracking-wide text-paper-400 dark:border-paper-800 dark:text-paper-500">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Detail</th>
                  <th className="px-4 py-2.5 font-medium">IP</th>
                  <th className="px-4 py-2.5 font-medium text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-paper-100 last:border-0 dark:border-paper-800"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={entry.username || "system"} size="sm" />
                        <span className="font-medium text-paper-800 dark:text-paper-100">
                          {entry.username || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${actionBadgeColor(entry.action)}`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-paper-500 dark:text-paper-400">
                      {entry.detail || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-paper-400 dark:text-paper-500">
                      {entry.ipAddress || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-paper-400 dark:text-paper-500">
                      {formatDate(entry.createdAt)}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-paper-400">
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
