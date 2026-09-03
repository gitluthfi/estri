import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from "../components/icons";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  info: "border-paper-200 bg-white text-paper-800 dark:border-paper-700 dark:bg-paper-900 dark:text-paper-200",
};

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  success: <CheckIcon className="h-4 w-4 shrink-0 text-emerald-500" />,
  error: <WarningIcon className="h-4 w-4 shrink-0 text-red-500" />,
  info: <InfoIcon className="h-4 w-4 shrink-0 text-paper-400" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    push,
    success: (title, description) => push({ variant: "success", title, description }),
    error: (title, description) => push({ variant: "error", title, description }),
    info: (title, description) => push({ variant: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-card animate-[toast-in_0.18s_ease-out] ${VARIANT_STYLES[t.variant]}`}
          >
            {VARIANT_ICON[t.variant]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs leading-snug opacity-80">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
              aria-label="Dismiss"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
