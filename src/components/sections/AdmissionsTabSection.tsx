"use client";
import { useEffect, useState } from "react";
import { CalendarClock, FileText, Lock, Search } from "lucide-react";
import AdmissionsForm from "@/components/sections/AdmissionsForm";
import AdmissionsStatusCheck from "@/components/sections/AdmissionsStatusCheck";
import type { Lang } from "@/lib/lang";

const ui = {
  id: {
    form: "Formulir Pendaftaran", status: "Cek Status",
    tutup: "Pendaftaran sedang tutup",
    tutupKet: "Formulir belum bisa diisi karena tidak ada gelombang pendaftaran yang sedang dibuka.",
    berikutnya: "Gelombang berikutnya", dibukaPada: "dibuka",
    sudahDaftar: "Sudah mendaftar di gelombang sebelumnya? Status & hasil seleksi tetap bisa dicek.",
    keStatus: "Cek Status Pendaftaran",
  },
  en: {
    form: "Registration Form", status: "Check Status",
    tutup: "Registration is currently closed",
    tutupKet: "The form cannot be filled in because no registration wave is open right now.",
    berikutnya: "Next wave", dibukaPada: "opens",
    sudahDaftar: "Already registered in an earlier wave? You can still check your status and results.",
    keStatus: "Check Registration Status",
  },
};

/** `tutup` diisi halaman server bila TIDAK ada gelombang yang sedang dibuka (permintaan user 2 Okt 2026:
 *  "pendaftaran tertutup harusnya form daftar terkunci … atau ada keterangan"). Formulir tidak dirender
 *  sama sekali — dulu calon bisa mengisi keempat langkah lalu baru ditolak server (409) saat Kirim.
 *  Cek Status SENGAJA tetap terbuka: pendaftar gelombang sebelumnya masih perlu memantau hasilnya.
 *  Tautan `#cek-status` (tombol di pembuka halaman) langsung membuka tab Cek Status. */
export default function AdmissionsTabSection({ lang = "id", tutup = null }: {
  lang?: Lang;
  tutup?: { berikutnya: { nama: string; buka: string } | null } | null;
}) {
  const [tab, setTab] = useState<"form" | "status">("form");
  const t = ui[lang];

  useEffect(() => {
    const ikuti = () => {
      if (window.location.hash === "#cek-status") setTab("status");
      else if (window.location.hash === "#formulir") setTab("form");
    };
    ikuti();
    window.addEventListener("hashchange", ikuti);
    return () => window.removeEventListener("hashchange", ikuti);
  }, []);

  return (
    <div>
      <div className="flex gap-2 mb-5 p-1 panel">
        <button
          onClick={() => setTab("form")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            tab === "form"
              ? "bg-primary-700 text-white shadow-sm"
              : "text-gray-500 hover:text-primary-700"
          }`}
        >
          <FileText size={15} />
          {t.form}
        </button>
        <button
          onClick={() => setTab("status")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            tab === "status"
              ? "bg-primary-700 text-white shadow-sm"
              : "text-gray-500 hover:text-primary-700"
          }`}
        >
          <Search size={15} />
          {t.status}
        </button>
      </div>
      {tab === "status" ? <AdmissionsStatusCheck lang={lang} />
        : tutup ? (
          <div className="panel p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Lock size={22} />
            </span>
            <h3 className="font-heading mt-4 text-lg font-semibold text-primary-900">{t.tutup}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-gray-500">{t.tutupKet}</p>
            {tutup.berikutnya && (
              <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
                <CalendarClock size={16} className="shrink-0" />
                <span>{t.berikutnya}: <span className="font-semibold">{tutup.berikutnya.nama}</span> — {t.dibukaPada}{" "}
                  <span className="font-semibold">{tutup.berikutnya.buka}</span></span>
              </p>
            )}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-sm text-gray-500">{t.sudahDaftar}</p>
              <button type="button" onClick={() => setTab("status")} className="btn-modal-save mt-3">
                <Search size={16} /> {t.keStatus}
              </button>
            </div>
          </div>
        ) : <AdmissionsForm lang={lang} />}
    </div>
  );
}
