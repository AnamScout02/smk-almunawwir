"use client";
import { useState } from "react";
import { Sparkles, RotateCcw, ArrowRight, ChevronLeft } from "lucide-react";
import TombolBagikan from "@/components/shared/TombolBagikan";
import { acakKuis, hitungKuis, type SoalKuis } from "@/lib/kuis-jurusan";
import { catatJejak } from "@/lib/spmb-jejak";
import { themeGradient } from "@/lib/color";
import type { Lang } from "@/lib/lang";

type Jurusan = { code: string; name: string; tagline: string | null; career: string[]; themeColor: string | null };

const T = {
  id: {
    label: "Kuis Minat Jurusan", judul: "Bingung pilih jurusan?", ket: "Jawab beberapa pertanyaan singkat — kurang dari satu menit.",
    mulai: "Mulai Kuis", soal: (a: number, b: number) => `Pertanyaan ${a} dari ${b}`, kembali: "Kembali",
    hasil: "Jurusan yang paling cocok untukmu", cocok: (p: number) => `${p}% jawabanmu mengarah ke sini`,
    juga: "Juga cocok:", karier: "Peluang karier", daftar: "Daftar ke jurusan ini", lihat: "Lihat jurusan",
    bagikan: "Bagikan hasil", tersalin: "Tautan hasil disalin", ulangi: "Ulangi",
    pesan: (j: string, u: string) => `Hasil kuis minat jurusanku di SMK Al Munawwir IIBS: ${j}! Coba juga: ${u}`,
  },
  en: {
    label: "Program Match Quiz", judul: "Not sure which program to choose?", ket: "Answer a few quick questions — under a minute.",
    mulai: "Start Quiz", soal: (a: number, b: number) => `Question ${a} of ${b}`, kembali: "Back",
    hasil: "Your best-matching program", cocok: (p: number) => `${p}% of your answers point here`,
    juga: "Also a good fit:", karier: "Career paths", daftar: "Apply to this program", lihat: "View program",
    bagikan: "Share result", tersalin: "Result link copied", ulangi: "Retake",
    pesan: (j: string, u: string) => `My program match at SMK Al Munawwir IIBS: ${j}! Try it too: ${u}`,
  },
};

/** Kuis minat jurusan (CLAUDE.md #11 — pertanyaan dari data jurusan, lihat src/lib/kuis-jurusan.ts).
 *  "Daftar ke jurusan ini" mengisi pilihan jurusan di formulir lewat peristiwa `spmb-pilih-jurusan`
 *  lalu menggulir ke formulir; hasil yang DIBAGIKAN memakai `?jurusan=KODE` yang dibaca formulir. */
export default function KuisJurusanSpmb({ soal: soalTetap, bank = [], jumlah = 8, jurusan, lang, formTerbuka }: {
  soal: SoalKuis[]; bank?: SoalKuis[]; jumlah?: number; jurusan: Jurusan[]; lang: Lang; formTerbuka: boolean;
}) {
  const t = T[lang];
  const [mulai, setMulai] = useState(false);
  const [jawaban, setJawaban] = useState<number[]>([]);
  const [pesan, setPesan] = useState("");
  // Bank panitia → soal ACAK tiap kali kuis dimulai/diulang; tanpa bank → soal tetap dari data jurusan.
  const pakaiBank = bank.length >= 2;
  const [soal, setSoal] = useState<SoalKuis[]>(soalTetap);
  const kocok = () => { if (pakaiBank) setSoal(acakKuis(bank, jumlah)); };
  if ((pakaiBank ? bank : soalTetap).length < 2) return null;

  const selesai = jawaban.length >= soal.length;
  const ke = jawaban.length;

  function jawab(i: number) {
    const baru = [...jawaban, i];
    setJawaban(baru);
    if (baru.length >= soal.length) catatJejak("KUIS");
  }

  const kartu = "relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-900 to-primary-700 p-6 text-white sm:p-8";

  if (!mulai) return (
    <div className={`gerak-naik ${kartu} flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold"><Sparkles size={14} /> {t.label}</p>
        <h3 className="font-heading mt-2 text-2xl font-bold">{t.judul}</h3>
        <p className="mt-1 text-sm text-white/70">{t.ket}</p>
      </div>
      <button type="button" onClick={() => { kocok(); setMulai(true); }}
        className="spmb-kilau sentuh shrink-0 rounded-full bg-gold px-6 py-3 text-sm font-bold text-primary-900 transition hover:brightness-110">
        {t.mulai}
      </button>
    </div>
  );

  if (!selesai) {
    const s = soal[ke];
    return (
      <div className={kartu}>
        <div className="flex items-center justify-between gap-3 text-xs text-white/60">
          <span className="angka">{t.soal(ke + 1, soal.length)}</span>
          {ke > 0 && (
            <button type="button" onClick={() => setJawaban(j => j.slice(0, -1))} className="inline-flex items-center gap-1 hover:text-white">
              <ChevronLeft size={14} /> {t.kembali}
            </button>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${(ke / soal.length) * 100}%` }} />
        </div>
        <h3 key={`t${ke}`} className="spmb-muncul font-heading mt-5 text-xl font-semibold sm:text-2xl">{s.tanya[lang]}</h3>
        <div key={`p${ke}`} className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {s.pilihan.map((p, i) => (
            <button key={p.teks} type="button" onClick={() => jawab(i)} style={{ animationDelay: `${i * 60}ms` }}
              className="spmb-muncul sentuh rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-medium transition hover:border-gold hover:bg-white/15">
              {p.teks}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const urut = hitungKuis(soal, jawaban);
  const atas = jurusan.find(j => j.code === urut[0]?.kode);
  if (!atas) return null;
  const persen = Math.round(((urut[0]?.skor ?? 0) / soal.length) * 100);
  const lain = urut.slice(1, 3).filter(x => x.skor > 0).map(x => jurusan.find(j => j.code === x.kode)?.name).filter(Boolean);
  const tautan = typeof window !== "undefined" ? `${window.location.origin}/admissions?jurusan=${atas.code}` : "";

  return (
    <div className={kartu}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold"><Sparkles size={14} /> {t.hasil}</p>
      <div className="spmb-muncul mt-4 flex items-start gap-4">
        <span className="font-heading flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
          style={{ background: atas.themeColor ? themeGradient(atas.themeColor) : "rgb(255 255 255 / .15)" }}>{atas.code}</span>
        <div className="min-w-0">
          <h3 className="font-heading text-2xl font-bold">{atas.name}</h3>
          {atas.tagline && <p className="mt-1 text-sm text-white/70">{atas.tagline}</p>}
          <p className="mt-1 text-sm font-semibold text-gold">{t.cocok(persen)}</p>
        </div>
      </div>
      {atas.career.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{t.karier}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {atas.career.slice(0, 4).map(c => <span key={c} className="rounded-full bg-white/10 px-3 py-1 text-xs">{c}</span>)}
          </div>
        </div>
      )}
      {lain.length > 0 && <p className="mt-4 text-sm text-white/70">{t.juga} <span className="font-semibold text-white">{lain.join(", ")}</span></p>}
      <div className="mt-6 flex flex-wrap gap-2.5">
        {formTerbuka ? (
          <button type="button" className="spmb-kilau sentuh inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-primary-900"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("spmb-pilih-jurusan", { detail: atas.code }));
              window.location.hash = "formulir";
              document.getElementById("formulir")?.scrollIntoView({ behavior: "smooth" });
            }}>
            {t.daftar} <ArrowRight size={16} />
          </button>
        ) : (
          <a href={`/programs/${atas.code.toLowerCase()}`} className="sentuh inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-primary-900">
            {t.lihat} <ArrowRight size={16} />
          </a>
        )}
        <TombolBagikan judul={t.pesan(atas.name, "")} teks={t.pesan(atas.name, "").trim()} url={tautan} label={t.bagikan}
          className="sentuh inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10" />
        <button type="button" onClick={() => { kocok(); setJawaban([]); setPesan(""); }}
          className="sentuh inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10">
          <RotateCcw size={16} /> {t.ulangi}
        </button>
      </div>
      {pesan && <p className="mt-3 text-xs text-white/60">{pesan}</p>}
    </div>
  );
}
