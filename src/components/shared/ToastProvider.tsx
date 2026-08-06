"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastFn = (message: string) => void;
interface ToastApi { success: ToastFn; error: ToastFn; warning: ToastFn; info: ToastFn }
interface ToastEntry { id: number; variant: ToastVariant; message: string }

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { bg: string; border: string; icon: string; text: string; Icon: typeof CheckCircle }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", text: "text-emerald-800", Icon: CheckCircle },
  warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", text: "text-amber-800", Icon: AlertTriangle },
  error: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", text: "text-red-800", Icon: XCircle },
  info: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", text: "text-blue-800", Icon: Info },
};

const DURATION: Record<ToastVariant, number> = { success: 4000, warning: 4000, info: 4000, error: 6000 };

/** Provider notifikasi ringkas bertema (pengganti window.alert()) — dipasang sekali lewat
 * `Providers.tsx` di root layout. Pakai `useToast()` di komponen manapun untuk memicu. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, variant, message }]);
    setTimeout(() => dismiss(id), DURATION[variant]);
  }, [dismiss]);

  const api: ToastApi = {
    success: m => push("success", m),
    error: m => push("error", m),
    warning: m => push("warning", m),
    info: m => push("info", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-[calc(100%-2rem)] max-w-sm">
        <AnimatePresence>
          {toasts.map(t => {
            const s = VARIANT_STYLE[t.variant];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`${s.bg} ${s.border} border rounded-xl shadow-lg p-3.5 flex items-start gap-2.5`}
              >
                <s.Icon size={18} className={`${s.icon} shrink-0 mt-0.5`} />
                <p className={`${s.text} text-sm flex-1 min-w-0`}>{t.message}</p>
                <button onClick={() => dismiss(t.id)} className={`${s.icon} opacity-60 hover:opacity-100 transition-opacity shrink-0`}>
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}
