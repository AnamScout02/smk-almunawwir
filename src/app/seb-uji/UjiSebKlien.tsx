"use client";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

type Hasil = { adaSeb: boolean; adaHeader: boolean; cocokOtomatis: boolean; cocokBek: boolean; cocokCkManual: boolean; terverifikasi: boolean; baruTerverifikasi: boolean };

export default function UjiSebKlien() {
  const [h, setH] = useState<Hasil | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    fetch("/api/ujian/seb/uji", { cache: "no-store" })
      .then(r => r.json())
      .then(d => (d.error ? setGalat(d.error) : setH(d)))
      .catch(() => setGalat("Situs tidak bisa dihubungi."));
  }, []);

  const lolos = !!h && (h.cocokOtomatis || h.cocokBek || h.cocokCkManual);
  const baris = (ok: boolean, teks: string) => (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />}
      <span className="text-gray-700">{teks}</span>
    </li>
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <div className="panel w-full max-w-md p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-700 text-white"><ShieldCheck size={22} /></span>
          <div>
            <h1 className="font-heading text-lg font-semibold text-primary-900">Uji Safe Exam Browser</h1>
            <p className="text-sm text-gray-500">Buka halaman ini DI DALAM SEB di komputer lab.</p>
          </div>
        </div>
        {!h && !galat && <div className="flex justify-center py-10 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>}
        {galat && <p className="error-msg">{galat}</p>}
        {h && (
          <>
            <ul className="space-y-2">
              {baris(h.adaSeb, h.adaSeb ? "Halaman ini dibuka lewat Safe Exam Browser." : "Bukan Safe Exam Browser — buka berkas .seb dari Pengaturan Ujian.")}
              {baris(h.adaHeader, h.adaHeader ? "SEB mengirim tanda pengenal ujian." : "SEB tidak mengirim tanda pengenal (setelan \"Send Browser Exam Key\" mati).")}
              {baris(lolos, lolos ? "Konfigurasi komputer ini dikenali situs." : "Konfigurasi belum dikenali — unduh ulang berkas .seb terbaru.")}
            </ul>
            <p className={`mt-5 rounded-xl border p-4 text-sm ${lolos ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {lolos
                ? h.baruTerverifikasi
                  ? "Berhasil! Mulai sekarang ujian bertanda \"Wajib Safe Exam Browser\" hanya bisa dikerjakan lewat SEB."
                  : "Komputer ini siap dipakai untuk ujian bertanda \"Wajib Safe Exam Browser\"."
                : "Selama belum ada komputer yang lolos uji ini, ujian bertanda \"Wajib Safe Exam Browser\" belum dikunci — siswa tetap bisa masuk dari browser biasa."}
            </p>
            <a href="/ujian-online" className="btn-modal-save mt-5 w-full">Ke Halaman Ujian</a>
          </>
        )}
      </div>
    </main>
  );
}
