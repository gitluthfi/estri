import React from "react";
import type { AccessibleBucket } from "../types";

export function BucketSwitcher({
  buckets,
  current,
  onChange,
}: {
  buckets: AccessibleBucket[];
  current: string | null;
  onChange: (bucketName: string) => void;
}) {
  if (buckets.length === 0) {
    return (
      <div className="text-sm text-slate-400">No buckets available to you yet.</div>
    );
  }

  return (
    <select
      value={current ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {buckets.map((b) => (
        <option key={b.id} value={b.name}>
          {b.name} ({b.region})
        </option>
      ))}
    </select>
  );
}
