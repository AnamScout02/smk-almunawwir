"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "@/components/admin/Modal";

type ConfirmFn = (message: string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Provider dialog konfirmasi bertema (pengganti window.confirm()) — dipasang sekali lewat
 * `Providers.tsx` di root layout. Pakai `useConfirm()` untuk memicu, `await` hasilnya (boolean). */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirmDialog: ConfirmFn = useCallback((msg: string) => {
    setMessage(msg);
    return new Promise<boolean>(resolve => { resolveRef.current = resolve; });
  }, []);

  function decide(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setMessage(null);
  }

  return (
    <ConfirmContext.Provider value={confirmDialog}>
      {children}
      <Modal
        open={message !== null}
        onClose={() => decide(false)}
        title="Konfirmasi"
        footer={
          <>
            <button type="button" onClick={() => decide(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={() => decide(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex-1">
              Ya, Lanjutkan
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm harus dipakai di dalam ConfirmProvider");
  return ctx;
}
