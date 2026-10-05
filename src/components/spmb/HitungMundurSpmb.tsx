"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Hitung mundur besar di pembuka halaman SPMB: menuju PENUTUPAN gelombang yang sedang dibuka,
 *  atau menuju PEMBUKAAN gelombang berikutnya. Angka baru dihitung setelah dimuat di browser —
 *  menghitungnya saat render server membuat markup server & browser berbeda (CLAUDE.md #15).
 *  Begitu waktunya tiba, halaman dimuat ulang dari server supaya status buka/tutup ikut berganti. */
export default function HitungMundurSpmb({ target, judul, satuan, kelasKotak, kelasLabel }: {
  target: string; judul: string; satuan: [string, string, string, string];
  /** Kelas warna dari tema halaman (kaca & teks lembut) — komponen ini tidak menebak tema sendiri. */
  kelasKotak: string; kelasLabel: string;
}) {
  const router = useRouter();
  const [sisa, setSisa] = useState<number | null>(null);

  useEffect(() => {
    const akhir = new Date(target).getTime();
    let segar = false;
    const jalan = () => {
      const s = Math.max(0, akhir - Date.now());
      setSisa(s);
      if (s === 0 && !segar) { segar = true; router.refresh(); }
    };
    jalan();
    const id = setInterval(jalan, 1000);
    return () => clearInterval(id);
  }, [target, router]);

  const bagian = sisa === null ? null : [
    Math.floor(sisa / 86_400_000), Math.floor(sisa / 3_600_000) % 24,
    Math.floor(sisa / 60_000) % 60, Math.floor(sisa / 1000) % 60,
  ];

  return (
    <div className="mt-7">
      <p className={`text-xs font-semibold uppercase tracking-widest ${kelasLabel}`}>{judul}</p>
      <div className="mt-3 flex gap-2.5 sm:gap-3" role="timer" aria-live="off">
        {satuan.map((s, i) => (
          <div key={s} className={`spmb-kartu flex w-[4.4rem] flex-col items-center rounded-2xl border px-2 py-3 sm:w-20 ${kelasKotak}`}>
            <span className="angka font-heading text-3xl font-bold leading-none sm:text-4xl">
              {bagian ? String(bagian[i]).padStart(2, "0") : "--"}
            </span>
            <span className="mt-1.5 text-xs font-medium uppercase tracking-wide opacity-70">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
