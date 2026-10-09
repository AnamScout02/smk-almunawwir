"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ImageIcon, Loader2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { siapkanPasFoto, type BahanPasFoto, type Kotak, type WarnaLatar } from "@/lib/pas-foto";
import type { Lang } from "@/lib/lang";

const T = {
  id: {
    judul: "Rapikan Pas Foto",
    ket: "Foto dipotong 3×4 dengan wajah di tengah. Pilih warna latar, lalu periksa hasilnya — terutama tepi rambut atau jilbab.",
    menyiapkan: "Menyiapkan pas foto…",
    latar: "Warna latar", merah: "Merah", biru: "Biru", asli: "Latar asli",
    tidakBisa: "Latar tidak bisa diganti otomatis pada foto ini (orangnya tidak terpisah jelas dari latar). Foto tetap dipotong 3×4.",
    pakai: "Pakai Foto Ini", fotoAsli: "Pakai Foto Asli",
  },
  en: {
    judul: "Tidy Up the Portrait Photo",
    ket: "The photo is cropped to 3×4 with the face centred. Choose a background colour, then check the result — especially around hair or hijab edges.",
    menyiapkan: "Preparing the photo…",
    latar: "Background", merah: "Red", biru: "Blue", asli: "Original",
    tidakBisa: "The background could not be replaced automatically for this photo. It is still cropped to 3×4.",
    pakai: "Use This Photo", fotoAsli: "Use Original Photo",
  },
};
const PILIHAN: { v: WarnaLatar; titik: string }[] = [
  { v: "merah", titik: "#DB1514" }, { v: "biru", titik: "#0066CC" }, { v: "asli", titik: "" },
];

/** FOTO PAS OTOMATIS (9 Okt 2026) — hasil selalu diperlihatkan dulu; "Latar asli" dan "Pakai Foto Asli" selalu ada
 *  (src/lib/pas-foto.ts). Tidak ada yang terkirim sebelum calon menekan Pakai. */
export default function PasFotoOtomatis({ kanvas, wajah, lang = "id", onPakai, onAsli, onTutup }: {
  kanvas: HTMLCanvasElement; wajah: Kotak; lang?: Lang;
  onPakai: (hasil: HTMLCanvasElement) => void; onAsli: () => void; onTutup: () => void;
}) {
  const t = T[lang];
  const [bahan, setBahan] = useState<BahanPasFoto | null>(null);
  const [warna, setWarna] = useState<WarnaLatar>("merah");

  useEffect(() => {
    let batal = false;
    siapkanPasFoto(kanvas, wajah).then(b => {
      if (batal) return;
      setBahan(b);
      if (!b.bisaGanti) setWarna("asli");
    }).catch(() => { if (!batal) onAsli(); });
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanvas, wajah]);

  const hasil = useMemo(() => bahan?.buat(warna) ?? null, [bahan, warna]);
  const url = useMemo(() => hasil?.toDataURL("image/jpeg", 0.85) ?? "", [hasil]);

  return (
    <Modal open onClose={onTutup} title={t.judul} size="md" scrollBody
      footer={
        <>
          <button type="button" className="btn-modal-cancel flex-1" onClick={onAsli}><ImageIcon /> {t.fotoAsli}</button>
          <button type="button" className="btn-modal-save flex-1" disabled={!hasil} onClick={() => hasil && onPakai(hasil)}><Check /> {t.pakai}</button>
        </>
      }>
      <>
        <p className="text-sm text-gray-600">{t.ket}</p>
        <div className="flex justify-center rounded-xl bg-gray-100 p-3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-[46vh] w-auto rounded-lg shadow-panel" style={{ aspectRatio: "3 / 4" }} />
          ) : (
            <div className="flex h-56 items-center gap-2 text-sm text-gray-400"><Loader2 size={24} className="animate-spin" /> {t.menyiapkan}</div>
          )}
        </div>
        {bahan && (
          <div>
            <p className="label-field">{t.latar}</p>
            <div className="flex flex-wrap gap-2">
              {PILIHAN.map(p => {
                const mati = p.v !== "asli" && !bahan.bisaGanti;
                return (
                  <button key={p.v} type="button" disabled={mati} onClick={() => setWarna(p.v)} aria-pressed={warna === p.v}
                    className={`sentuh flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40 ${
                      warna === p.v ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                    {p.titik && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/60" style={{ background: p.titik }} />}
                    {t[p.v]}
                  </button>
                );
              })}
            </div>
            {!bahan.bisaGanti && <p className="mt-2 text-xs text-amber-700">{t.tidakBisa}</p>}
          </div>
        )}
      </>
    </Modal>
  );
}
