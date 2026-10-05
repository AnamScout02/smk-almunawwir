"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { IsiGambar } from "@/lib/spmb-konten";

/** Poster SPMB — tumpukan kartu yang DIKIPASKAN ke kiri & kanan dengan yang aktif di tengah depan
 *  (permintaan user 2 Oktober 2026), berganti sendiri tiap 6 detik, membesar halus saat ditunjuk.
 *
 *  Yang dijaga dan alasannya:
 *  - Kartu TERDEPAN sudah utuh terlihat sejak muat; kipasnya hanya menata yang di belakang. Jadi
 *    halaman tidak pernah tampil kosong bila animasi tidak jalan.
 *  - Geometri dari TABEL TETAP, bukan `Math.random()` — nilai acak di komponen klien yang dirender
 *    di server membuat markup server & browser berbeda (CLAUDE.md #15).
 *  - Lebar kartu 64% dari wadahnya supaya kipas ke samping tetap MUAT; tanpa itu kartu sampingnya
 *    menonjol keluar kolom dan halaman bisa digeser menyamping di HP (DESIGN_SYSTEM §17.4 butir 8).
 *  - Semua gerak dimatikan bila pengguna memilih "kurangi gerak" di perangkatnya.
 *  - BENTUK KARTU MENGIKUTI POSTER (temuan user 2 Okt 2026: "poster terpotong"). Dulu wadah dipatok
 *    3:4 dan kartunya 64% lebarnya → kartu ±1:2, jauh lebih ramping dari poster, dan `object-cover`
 *    memotong kiri-kanannya. Sekarang perbandingan diambil dari ukuran ASLI poster terdepan saat
 *    gambarnya termuat, dan gambar `object-contain` — poster lain yang bentuknya berbeda tidak
 *    terpotong; sisa ruangnya diisi salinan gambar yang sama yang diburamkan.
 *  - Panitia boleh MENETAPKAN bentuk (`rasioTetap`, potret/persegi/lanskap) dan cara isi (`isi`:
 *    utuh/penuh) di Pusat SPMB → Poster & Promosi. Kartu lanskap dibuat lebih lebar (80%) dan
 *    kipasnya dipersempit supaya kartu samping tetap di dalam kolom.
 *  - Di laptop seluruh kipas MIRING MENGIKUTI KURSOR (efek 3D halus, maks ±7°). Hanya untuk tetikus
 *    — di layar sentuh sentuhan dipakai untuk mengganti poster, bukan memiringkan. */

/** Urutan kipas: TENGAH → KANAN → KIRI → kanan jauh → kiri jauh. Dengan urutan ini, dua poster pun
 *  sudah terlihat disengaja (tengah + kanan), bukan timpang ke satu sisi. */
/** Lebar ÷ tinggi kartu sebelum gambar termuat — A4/A3 potret, bentuk poster cetak paling umum. */
const RASIO_AWAL = 1 / 1.414;

const LAPIS = [
  { x: 0, y: 0, putar: 0, skala: 1, buram: 0 },
  { x: 24, y: 14, putar: 8.5, skala: 0.86, buram: 0 },
  { x: -24, y: 14, putar: -8.5, skala: 0.86, buram: 0 },
  { x: 13, y: 27, putar: 4, skala: 0.74, buram: 1 },
  { x: -13, y: 27, putar: -4, skala: 0.74, buram: 1 },
];

export default function PosterSpmb({ posters, alt, cincin, rasioTetap = null, isi = "utuh" }: {
  posters: string[]; alt: string; cincin: string; rasioTetap?: number | null; isi?: IsiGambar;
}) {
  const [ke, setKe] = useState(0);
  const [sorot, setSorot] = useState(false);
  const [diam, setDiam] = useState(false);
  const [rasio, setRasio] = useState<Record<string, number>>({});
  const [miring, setMiring] = useState({ x: 0, y: 0 });
  const kurangiGerak = useRef(false);
  const banyak = posters.length > 1;

  useEffect(() => {
    const k = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    kurangiGerak.current = k;
    setDiam(k);
  }, []);

  const maju = useCallback(() => setKe(k => (k + 1) % posters.length), [posters.length]);

  useEffect(() => {
    if (!banyak || sorot || kurangiGerak.current) return;
    const id = setInterval(() => { if (!document.hidden) maju(); }, 6000);
    return () => clearInterval(id);
  }, [banyak, sorot, maju]);

  if (!posters.length) return null;

  // Batasi supaya poster yang sangat lebar/sangat tinggi tidak merusak tata letak kolom.
  const r = Math.min(1.8, Math.max(0.5, rasioTetap ?? rasio[posters[ke]] ?? RASIO_AWAL));
  const lebar = r > 1 ? 0.8 : 0.64;          // bagian lebar wadah yang dipakai kartu
  const kipas = 0.64 / lebar;                // kartu lebar → kipas ke samping dipersempit

  return (
    <div onMouseEnter={() => setSorot(true)} onMouseLeave={() => { setSorot(false); setMiring({ x: 0, y: 0 }); }}
      onPointerMove={e => {
        if (diam || e.pointerType !== "mouse") return;
        const b = e.currentTarget.getBoundingClientRect();
        setMiring({ x: ((e.clientX - b.left) / b.width - 0.5) * 14, y: ((e.clientY - b.top) / b.height - 0.5) * -14 });
      }}>
      <div className="relative mx-auto w-full max-w-md"
        style={{
          aspectRatio: `${r / lebar}`,
          transform: diam ? undefined : `perspective(1100px) rotateX(${miring.y}deg) rotateY(${miring.x}deg)`,
          transition: diam ? undefined : "aspect-ratio .5s ease, transform .25s ease-out",
        }}>
        {posters.map((url, i) => {
          const jarak = (i - ke + posters.length) % posters.length;   // 0 = terdepan
          const tampil = jarak < LAPIS.length;
          const l = LAPIS[Math.min(jarak, LAPIS.length - 1)];
          const depan = jarak === 0;

          // Saat disorot: yang depan terangkat & membesar, yang samping merenggang sedikit —
          // kipasnya "membuka", bukan sekadar satu kartu yang membesar sendirian.
          const renggang = sorot && !diam ? 1.16 : 1;
          const skala = diam ? 1 : l.skala * (depan && sorot ? 1.06 : 1);
          const naik = depan && sorot && !diam ? -10 : 0;

          return (
            <button key={url} type="button"
              aria-label={depan ? `Poster ${i + 1} — ketuk untuk berikutnya` : `Tampilkan poster ${i + 1}`}
              onClick={() => (depan ? maju() : setKe(i))}
              style={{
                zIndex: posters.length - jarak,
                opacity: tampil ? 1 : 0,
                filter: l.buram && !diam ? "brightness(.82)" : undefined,
                /* Kartu terdepan TETAP menerima klik supaya ia menghalangi kartu di belakangnya —
                   tanpa itu, klik di tengah poster tembus ke bawah dan melompat ke poster lain. */
                pointerEvents: tampil ? "auto" : "none",
                width: `${lebar * 100}%`,
                transform: diam
                  ? "translate(-50%, 0)"
                  : `translate(calc(-50% + ${l.x * renggang * kipas}%), ${l.y + naik}px) rotate(${l.putar}deg) scale(${skala})`,
                transition: diam ? undefined
                  : "transform .6s cubic-bezier(0.22, 1.2, 0.36, 1), opacity .5s ease, filter .5s ease, box-shadow .4s ease",
              }}
              className={`spmb-poster absolute left-1/2 top-0 h-full cursor-pointer bg-white/10 overflow-hidden rounded-3xl ring-4 ${cincin} ${
                depan ? "shadow-[0_28px_60px_-24px_rgba(0,0,0,.75)]" : "shadow-xl"}`}>
              {isi === "utuh" && (
                <Image src={url} alt="" aria-hidden fill sizes="(max-width: 640px) 70vw, 20rem"
                  className="scale-110 object-cover opacity-60 blur-xl" />
              )}
              <Image src={url} alt={posters.length > 1 ? `${alt} ${i + 1}` : alt} fill priority={i === 0}
                sizes="(max-width: 640px) 70vw, 20rem" className={isi === "penuh" ? "object-cover" : "object-contain"}
                onLoad={e => {
                  const g = e.currentTarget;
                  if (g.naturalWidth && g.naturalHeight)
                    setRasio(m => (m[url] ? m : { ...m, [url]: g.naturalWidth / g.naturalHeight }));
                }} />
            </button>
          );
        })}
      </div>

      {banyak && (
        <div className="mt-10 flex items-center justify-center gap-2">
          {posters.map((url, i) => (
            <button key={url} type="button" onClick={() => setKe(i)}
              aria-label={`Poster ${i + 1} dari ${posters.length}`} aria-current={i === ke}
              className={`h-2 rounded-full transition-all duration-300 ${i === ke ? "w-7 bg-current opacity-90" : "w-2 bg-current opacity-40 hover:opacity-70"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
