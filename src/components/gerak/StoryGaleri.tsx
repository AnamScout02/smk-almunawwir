"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type Story = { judul: string; foto: string[] };

const DURASI = 5000;
const KUNCI_DILIHAT = "story-dilihat";

/** Story ala Instagram (2 Oktober 2026): deret lingkaran foto; diketuk → layar penuh berganti
 *  otomatis tiap 5 detik dengan bilah kemajuan per foto. Ketuk sisi kiri/kanan = mundur/maju,
 *  tahan = jeda, geser ke bawah / Esc / X = tutup. Lingkaran yang sudah dilihat jadi abu-abu
 *  (diingat di localStorage). Isinya dari galeri yang SUDAH ada (galeri promosi SPMB), bukan
 *  unggahan baru. Pergantian dihitung pewaktu JavaScript, jadi tetap jalan saat "kurangi gerak". */
export default function StoryGaleri({ story, gelap = true }: { story: Story[]; gelap?: boolean }) {
  const daftar = story.filter(s => s.foto.length);
  const [buka, setBuka] = useState<number | null>(null);
  const [ke, setKe] = useState(0);
  const [jeda, setJeda] = useState(false);
  const [dilihat, setDilihat] = useState<string[]>([]);
  const awalSentuh = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    try { setDilihat(JSON.parse(localStorage.getItem(KUNCI_DILIHAT) ?? "[]")); } catch { /* abaikan */ }
  }, []);

  const tutup = useCallback(() => { setBuka(null); setKe(0); setJeda(false); }, []);
  const maju = useCallback(() => {
    if (buka === null) return;
    if (ke + 1 < daftar[buka].foto.length) { setKe(ke + 1); return; }
    if (buka + 1 < daftar.length) { setBuka(buka + 1); setKe(0); return; }
    tutup();
  }, [buka, ke, daftar, tutup]);
  const mundur = useCallback(() => {
    if (buka === null) return;
    if (ke > 0) { setKe(ke - 1); return; }
    if (buka > 0) { setBuka(buka - 1); setKe(0); }
  }, [buka, ke]);

  // Pergantian otomatis & tanda "sudah dilihat".
  useEffect(() => {
    if (buka === null || jeda) return;
    const id = setTimeout(maju, DURASI);
    return () => clearTimeout(id);
  }, [buka, ke, jeda, maju]);
  useEffect(() => {
    if (buka === null) return;
    const j = daftar[buka].judul;
    setDilihat(d => {
      if (d.includes(j)) return d;
      const baru = [...d, j];
      try { localStorage.setItem(KUNCI_DILIHAT, JSON.stringify(baru)); } catch { /* abaikan */ }
      return baru;
    });
  }, [buka, daftar]);
  useEffect(() => {
    if (buka === null) return;
    const kunci = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
      else if (e.key === "ArrowRight") maju();
      else if (e.key === "ArrowLeft") mundur();
    };
    document.addEventListener("keydown", kunci);
    const gulir = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", kunci); document.body.style.overflow = gulir; };
  }, [buka, maju, mundur, tutup]);

  if (!daftar.length) return null;
  const s = buka !== null ? daftar[buka] : null;

  return (
    <>
      <ul className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ ["--latar-story" as string]: gelap ? "#0F1A45" : "#ffffff" }}>
        {daftar.map((st, i) => {
          const sudah = dilihat.includes(st.judul);
          return (
            <li key={st.judul + i} className="shrink-0">
              <button type="button" onClick={() => { setBuka(i); setKe(0); }}
                className="group flex w-20 flex-col items-center gap-2" aria-label={`Lihat cerita ${st.judul}`}>
                <span className={`${sudah ? "rounded-full bg-gray-300/50 p-[3px]" : "cincin-story"} transition group-hover:scale-105`}>
                  <span className="relative block h-[4.25rem] w-[4.25rem] overflow-hidden rounded-full" style={{ background: "var(--latar-story)" }}>
                    <Image src={st.foto[0]} alt="" fill sizes="68px" className="rounded-full object-cover p-0.5" />
                  </span>
                </span>
                <span className={`line-clamp-1 w-full text-center text-xs font-medium ${gelap ? "text-white/80" : "text-gray-600"}`}>{st.judul}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {s && buka !== null && (
        <div role="dialog" aria-modal="true" aria-label={s.judul}
          className={`fixed inset-0 z-[70] flex items-center justify-center bg-black ${jeda ? "story-jeda" : ""}`}>
          <div className="relative h-full w-full max-w-md overflow-hidden sm:h-[92dvh] sm:rounded-2xl"
            onPointerDown={e => { awalSentuh.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setJeda(true); }}
            onPointerUp={e => {
              const a = awalSentuh.current; awalSentuh.current = null; setJeda(false);
              if (!a) return;
              if (e.clientY - a.y > 90) { tutup(); return; }              // geser ke bawah = tutup
              if (Date.now() - a.t > 350) return;                          // ditahan = hanya jeda
              const b = e.currentTarget.getBoundingClientRect();
              if (e.clientX - b.left < b.width / 3) mundur(); else maju();
            }}
            onPointerCancel={() => { awalSentuh.current = null; setJeda(false); }}>
            <Image key={`${buka}-${ke}`} src={s.foto[ke]} alt={`${s.judul} ${ke + 1}`} fill sizes="448px" priority
              className="object-contain" />
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pb-10">
              <div className="flex gap-1">
                {s.foto.map((_, i) => (
                  <span key={i} className="story-bilah h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                    <span key={`${buka}-${ke}-${i}`} style={{ ["--durasi-story" as string]: `${DURASI}ms` }}
                      className={`block h-full rounded-full bg-white ${i < ke ? "" : i === ke ? "story-berjalan" : "scale-x-0"}`} />
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{s.judul}</p>
            </div>
            <button type="button" onClick={e => { e.stopPropagation(); tutup(); }} onPointerDown={e => e.stopPropagation()}
              aria-label="Tutup" className="absolute right-3 top-8 rounded-full bg-black/40 p-2 text-white">
              <X size={20} />
            </button>
          </div>
          <button type="button" onClick={mundur} aria-label="Sebelumnya" className="absolute left-4 hidden rounded-full bg-white/10 p-3 text-white hover:bg-white/20 lg:block">
            <ChevronLeft size={22} />
          </button>
          <button type="button" onClick={maju} aria-label="Berikutnya" className="absolute right-4 hidden rounded-full bg-white/10 p-3 text-white hover:bg-white/20 lg:block">
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </>
  );
}
