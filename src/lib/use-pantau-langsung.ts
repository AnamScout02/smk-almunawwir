"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type ModePantau = "langsung" | "menyambung" | "berkala";

/** Papan pantau ujian untuk layar pengawas. Utamanya LANGSUNG lewat Server-Sent Events
 * (`/api/teacher/exams/[id]/pantau/stream`): perubahan status siswa sampai dalam ±2 detik. Kalau stream
 * tidak bisa dipakai (browser tanpa EventSource, stream ditolak/ditutup server, jaringan menahan koneksi
 * panjang) otomatis kembali ke polling GET `/pantau` tiap 5 detik — perilaku lama — jadi papan tidak
 * pernah berhenti.
 *
 * Server hanya mengirim ulang papan kalau isinya berubah (atau tiap 15 detik), jadi `sisaDetik` bisa
 * basi beberapa detik. Pakai `sisa(b.sisaDetik)` untuk hitung mundur yang berjalan tiap detik di browser. */
export function usePantauLangsung<T extends { baris: { sisaDetik: number | null }[] }>(examId: string | null, aktif = true) {
  const [data, setData] = useState<T | null>(null);
  const [mode, setMode] = useState<ModePantau>("menyambung");
  const [diterimaPada, setDiterimaPada] = useState(0);
  const [, setDetak] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const terima = useCallback((d: T) => { setData(d); setDiterimaPada(Date.now()); }, []);

  const muatSekali = useCallback(() => {
    if (!examId) return;
    fetch(`/api/teacher/exams/${examId}/pantau`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && terima(d))
      .catch(() => {});
  }, [examId, terima]);

  useEffect(() => {
    setData(null);
    if (!examId || !aktif) return;

    let es: EventSource | null = null;
    let selesai = false;
    const mulaiPolling = () => {
      if (selesai || pollingRef.current) return;
      es?.close();
      setMode("berkala");
      muatSekali();
      pollingRef.current = setInterval(muatSekali, 5000);
    };

    if (typeof EventSource === "undefined") {
      mulaiPolling();
    } else {
      setMode("menyambung");
      es = new EventSource(`/api/teacher/exams/${examId}/pantau/stream`);
      // Stream belum mengirim papan dalam 8 detik (proxy menahan / server sibuk) → jangan biarkan layar kosong.
      const cadangan = setTimeout(() => { if (!selesai && es?.readyState !== EventSource.OPEN) mulaiPolling(); }, 8000);
      es.addEventListener("papan", e => {
        try { terima(JSON.parse((e as MessageEvent).data)); setMode("langsung"); } catch {}
      });
      es.addEventListener("tutup", () => mulaiPolling());
      es.onerror = () => {
        // CLOSED = server menolak (401/404) atau stream tak bisa dipakai → polling. CONNECTING = browser
        // sedang menyambung ulang sendiri (mis. stream ditutup setelah 10 menit) → cukup tandai.
        if (es?.readyState === EventSource.CLOSED) mulaiPolling();
        else setMode(m => (m === "berkala" ? m : "menyambung"));
      };
      return () => {
        selesai = true;
        clearTimeout(cadangan);
        es?.close();
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      };
    }
    return () => {
      selesai = true;
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [examId, aktif, muatSekali, terima]);

  // Detak 1 detik hanya untuk hitung mundur sisa waktu di layar.
  useEffect(() => {
    if (!examId || !aktif) return;
    const t = setInterval(() => setDetak(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [examId, aktif]);

  const sisa = useCallback((sisaDetik: number | null) => {
    if (sisaDetik === null || !diterimaPada) return sisaDetik;
    return Math.max(0, sisaDetik - Math.floor((Date.now() - diterimaPada) / 1000));
  }, [diterimaPada]);

  return { data, mode, sisa, muatUlang: muatSekali };
}
