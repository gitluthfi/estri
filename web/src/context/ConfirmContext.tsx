import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { WarningIcon } from "../components/icons";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

// A promise-based replacement for window.confirm(): styled to match the
// rest of the app instead of the browser's native dialog, and returns a
// boolean the same way `confirm()` does so call sites stay simple:
//   if (!(await confirm({ title: "Delete file?", danger: true }))) return;
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-paper-950/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm animate-[pop-in_0.15s_ease-out] rounded-2xl border border-paper-200 bg-white p-6 shadow-card dark:border-paper-800 dark:bg-paper-900">
            <div className="flex items-start gap-3">
              {options.danger && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950">
                  <WarningIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-paper-900 dark:text-paper-50">
                  {options.title}
                </h2>
                {options.description && (
                  <p className="mt-1.5 text-sm text-paper-600 dark:text-paper-400">
                    {options.description}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => settle(false)} className="btn-secondary">
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => settle(true)}
                className={options.danger ? "btn-danger" : "btn-primary"}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
