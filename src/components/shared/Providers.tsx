"use client";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { ConfirmProvider } from "@/components/shared/ConfirmProvider";

/** Bungkus root layout dengan provider notifikasi & konfirmasi bertema (pengganti
 * window.alert()/confirm() bawaan browser) — satu titik pasang untuk seluruh app. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
