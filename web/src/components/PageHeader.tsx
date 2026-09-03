import React from "react";

export function PageHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-50 text-ember-600 dark:bg-ember-950 dark:text-ember-400">
          {icon}
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold text-paper-900 dark:text-paper-50">
            {title}
          </h1>
          <p className="mt-0.5 max-w-xl text-sm text-paper-500 dark:text-paper-400">
            {description}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}
