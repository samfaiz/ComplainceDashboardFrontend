"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "./utils";

type ToastVariant = "default" | "success" | "error" | "warning";
interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, variant: "default", ...t }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border bg-card p-4 shadow-lg animate-in",
              t.variant === "success" && "border-success/40",
              t.variant === "error" && "border-destructive/50",
              t.variant === "warning" && "border-warning/50"
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  t.variant === "success" && "bg-success",
                  t.variant === "error" && "bg-destructive",
                  t.variant === "warning" && "bg-warning",
                  t.variant === "default" && "bg-primary"
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-card-foreground">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">{t.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
