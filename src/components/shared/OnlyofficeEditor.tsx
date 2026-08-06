"use client";
import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (elId: string, config: Record<string, unknown>) => { destroyEditor: () => void } };
  }
}

/** Wrapper editor dokumen ONLYOFFICE (mirip Word/Google Docs asli, bukan sekadar rich-text HTML) —
 * memuat script `api.js` dari Document Server publik lalu instansiasi DocEditor di dalam elemen ini. */
export default function OnlyofficeEditor({ onlyofficeUrl, configUrl }: { onlyofficeUrl: string; configUrl: string }) {
  const containerId = `onlyoffice-${useId().replace(/:/g, "")}`;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let editor: { destroyEditor: () => void } | null = null;
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch(configUrl);
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Gagal memuat konfigurasi editor"); }
        const config = await res.json();
        if (cancelled) return;

        if (!window.DocsAPI) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Gagal memuat Document Server. Pastikan layanan editor sedang aktif."));
            document.body.appendChild(script);
          });
        }
        if (cancelled || !window.DocsAPI) return;
        editor = new window.DocsAPI.DocEditor(containerId, config);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : "Gagal memuat editor"); setLoading(false); }
      }
    }
    init();

    return () => {
      cancelled = true;
      editor?.destroyEditor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configUrl, onlyofficeUrl]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-center px-6">
        <div>
          <p className="text-red-600 font-semibold mb-2">Gagal memuat editor Word</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-64px)]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      )}
      <div id={containerId} className="w-full h-full" />
    </div>
  );
}
