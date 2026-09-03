import React from "react";
import { CloseIcon } from "./icons";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper-950/40 px-4 backdrop-blur-[2px]">
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} animate-[pop-in_0.15s_ease-out] rounded-2xl border border-paper-200 bg-white p-6 shadow-card dark:border-paper-800 dark:bg-paper-900`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-paper-900 dark:text-paper-50">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-paper-400 hover:bg-paper-100 hover:text-paper-700 dark:hover:bg-paper-800 dark:hover:text-paper-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
