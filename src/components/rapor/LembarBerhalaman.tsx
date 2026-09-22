"use client";
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** PEMENGGAL HALAMAN CETAK (22 September 2026) — rapor makro sekolah mencetak kaki halaman di SETIAP lembar
 * ("Raport … | nama | NIS | Kelas | Semester | Tahun | hal N") dengan nomor halaman buku rapor. CSS cetak biasa tidak bisa
 * memberi kaki berisi data per siswa + nomor halaman, jadi isi dipotong di browser: setiap blok diukur sekali (setelah
 * font termuat), lalu disusun ke lembar A4 berukuran tetap. Baris tabel yang pindah lembar mendapat ulang kepala tabelnya;
 * blok `tahan` selalu ikut blok sesudahnya (judul bagian tidak tertinggal sendirian di dasar lembar).
 *
 * Aturan menulis blok: jarak antarblok pakai PADDING di dalam blok (bukan margin) supaya tinggi yang diukur = tinggi
 * yang terpakai. Satu baris tabel = satu <table> dengan <colgroup> yang sama supaya kolomnya segaris. */

export interface Blok { k: string; isi: ReactNode; kepala?: string; tahan?: boolean }
export interface DokumenCetak { k: string; blok: Blok[]; kepala?: Record<string, ReactNode>; kaki: (halaman: number) => ReactNode; mulai: number }

export interface UkuranLembar { atas: number; kanan: number; bawah: number; kiri: number; kaki: number } // mm

type Susunan = string[][][]; // dokumen → lembar → kunci blok ("#kepala" = ulang kepala tabel)

export default function LembarBerhalaman({ dokumen, ukuran, versi }: { dokumen: DokumenCetak[]; ukuran: UkuranLembar; versi: string }) {
  const ukurRef = useRef<HTMLDivElement>(null);
  const [susunan, setSusunan] = useState<{ versi: string; hasil: Susunan } | null>(null);
  const tinggiIsi = 297 - ukuran.atas - ukuran.bawah - ukuran.kaki;
  const lebarIsi = 210 - ukuran.kiri - ukuran.kanan;
  const siap = susunan?.versi === versi;

  useLayoutEffect(() => {
    if (siap) return;
    let batal = false;
    const hitung = () => {
      const akar = ukurRef.current;
      if (!akar || batal) return;
      const tinggi = new Map<string, number>();
      akar.querySelectorAll<HTMLElement>("[data-ukur]").forEach(el => tinggi.set(el.dataset.ukur!, el.getBoundingClientRect().height));
      const H = tinggi.get("__lembar") ?? 1000;
      const hasil: Susunan = dokumen.map(d => {
        const lembar: string[][] = [[]];
        let pakai = 0;
        const t = (k: string) => tinggi.get(`${d.k}|${k}`) ?? 0;
        d.blok.forEach((b, i) => {
          // Tinggi yang harus muat bersama: blok ini + rantai blok `tahan` sampai blok biasa berikutnya.
          let perlu = t(b.k);
          if (b.tahan) for (let j = i + 1; j < d.blok.length; j++) { perlu += t(d.blok[j].k); if (!d.blok[j].tahan) break; }
          const kini = lembar[lembar.length - 1];
          if (kini.length && pakai + perlu > H) { lembar.push([]); pakai = 0; }
          const isi = lembar[lembar.length - 1];
          if (!isi.length && b.kepala && b.kepala !== b.k) { isi.push(`#${b.kepala}`); pakai += t(`#${b.kepala}`); }
          isi.push(b.k);
          pakai += t(b.k);
        });
        return lembar;
      });
      setSusunan({ versi, hasil });
    };
    // Ukur setelah semua font (Arial Narrow, Amiri) siap — ukuran huruf cadangan berbeda tinggi barisnya.
    const tunggu = typeof document !== "undefined" && document.fonts?.ready ? document.fonts.ready : Promise.resolve();
    tunggu.then(() => requestAnimationFrame(hitung)).catch(hitung);
    return () => { batal = true; };
  }, [siap, versi, dokumen]);

  const gayaLembar = { padding: `${ukuran.atas}mm ${ukuran.kanan}mm ${ukuran.bawah}mm ${ukuran.kiri}mm` };

  return (
    // SATU wadah .print-doc (font Arial Narrow + motif kertas `fixed` yang diulang browser di tiap lembar cetak). Lembar
    // di dalamnya SENGAJA bukan .print-doc: setiap .print-doc memasang lapisan motif sendiri, sehingga 30 lembar = motif
    // bertumpuk 30 kali. Saat cetak latar lembar transparan supaya motif wadah terlihat.
    <div className="print-doc bg-white tumpukan-lembar">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        .lembar-rapor { width: 210mm; height: 296.5mm; position: relative; overflow: hidden; background: #fff; box-sizing: border-box; color: #000; }
        .lembar-rapor + .lembar-rapor { break-before: page; }
        @media screen { .tumpukan-lembar { background: #eef0f5 !important; padding: 1rem 0; overflow-x: auto; }
          .lembar-rapor { box-shadow: 0 1px 3px rgb(15 26 69 / .12), 0 8px 24px rgb(15 26 69 / .08); margin: 0 auto 1.5rem; } }
        @media print { .lembar-rapor { background: transparent; } }
      `}</style>

      {!siap && (
        <div ref={ukurRef} aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: `${lebarIsi}mm`, visibility: "hidden", color: "#000" }}>
          <div data-ukur="__lembar" style={{ height: `${tinggiIsi}mm` }} />
          {dokumen.map(d => (
            <Fragment key={d.k}>
              {Object.entries(d.kepala ?? {}).map(([k, isi]) => <div key={`#${k}`} data-ukur={`${d.k}|#${k}`}>{isi}</div>)}
              {d.blok.map(b => <div key={b.k} data-ukur={`${d.k}|${b.k}`}>{b.isi}</div>)}
            </Fragment>
          ))}
        </div>
      )}

      {!siap ? (
        <p className="py-16 text-center text-sm text-gray-500 print:hidden">Menyusun halaman…</p>
      ) : dokumen.map((d, di) => {
        const peta = new Map(d.blok.map(b => [b.k, b.isi]));
        return susunan!.hasil[di].map((isiLembar, li) => (
          <div key={`${d.k}-${li}`} className="lembar-rapor" style={gayaLembar}>
            <div style={{ height: `${tinggiIsi}mm` }}>
              {isiLembar.map(k => <Fragment key={k}>{k.startsWith("#") ? d.kepala?.[k.slice(1)] : peta.get(k)}</Fragment>)}
            </div>
            <div style={{ position: "absolute", left: `${ukuran.kiri}mm`, right: `${ukuran.kanan}mm`, bottom: `${ukuran.bawah}mm`, height: `${ukuran.kaki}mm` }}>
              {d.kaki(d.mulai + li)}
            </div>
          </div>
        ));
      })}
    </div>
  );
}
