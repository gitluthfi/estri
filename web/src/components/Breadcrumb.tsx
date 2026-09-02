import React from "react";

export function Breadcrumb({
  bucket,
  prefix,
  onNavigate,
}: {
  bucket: string;
  prefix: string;
  onNavigate: (prefix: string) => void;
}) {
  const parts = prefix.split("/").filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      <button
        onClick={() => onNavigate("")}
        className="rounded px-1.5 py-0.5 font-medium text-slate-700 hover:bg-slate-100"
      >
        {bucket}
      </button>
      {parts.map((part, i) => {
        const path = parts.slice(0, i + 1).join("/") + "/";
        return (
          <React.Fragment key={path}>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => onNavigate(path)}
              className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-900"
            >
              {part}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
