"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Upload, Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import type { Jawaban } from "@/lib/soal";
import HtmlSoal, { TeksRumus } from "@/components/ujian/HtmlSoal";
import PaletRumus, { TombolRumus } from "@/components/ujian/PaletRumus";
import { TitikGambar, SeretLepas, Urutkan } from "@/components/ujian/SoalInteraktif";
import PerekamLisan from "@/components/ujian/PerekamLisan";
import { tahanPengawasan, lepasPengawasan } from "@/lib/perangkat-ujian";

/** Menampilkan SATU soal untuk dikerjakan siswa (semua tipe) - juga dipakai guru untuk pratinjau
 * dan halaman hasil (mode `tinjau`, kunci ditampilkan). Satu komponen supaya tampilan siswa dan
 * pratinjau guru tidak pernah berbeda. */

export interface SoalView {
  id: string;
  nomor: number;
  tipe: string;
  pertanyaan: string;
  /** `kode` dipakai sebagai nilai jawaban; `label` huruf yang ditampilkan (selalu urut A,B,C..). */
  opsi: { kode: string; label?: string; teks: string }[];
  kanan?: { kode: string; teks: string }[];
  skor: number;
  stimulus?: { id: string; judul: string; konten: string } | null;
  /** Diisi kalau soal ini diperbaiki pengawas setelah peserta mulai (edit live). */
  diperbarui?: string | null;
  /** hanya ada di mode tinjau */
  opsiBenar?: string[];
  kunci?: {
    pasangan?: Record<string, string>; jawaban?: string[]; rubrik?: string; acuan?: string;
    area?: { kode: string; x: number; y: number; w: number; h: number; label?: string }[]; urutan?: string[];
  } | null;
  /** TITIK_GAMBAR & SERET_LEPAS: gambar soal; TITIK_GAMBAR: banyak titik yang diketuk. */
  gambar?: string;
  jumlahTitik?: number;
  /** LISAN: lama rekaman maksimal (detik). */
  durasiMaks?: number;
}

const KODE_BS = { benar: "Benar", salah: "Salah" };

/** Pembatas audio listening: kontrol bawaan (termasuk bilah geser) dilepas dan diganti satu
 * tombol "Putar". Tiap putar meminta izin server (`minta`), yang menghitungnya di jejak attempt. */
export interface AturanAudio {
  batas: number;
  /** Hitungan putar yang sudah terjadi: kunci = id soal, atau "stim:<id wacana>". */
  hitungan: Record<string, number>;
  /** Minta izin memutar sekali; balas sisa putar (angka) atau false kalau ditolak. */
  minta: (arg: { questionId: string; stimulusId?: string }) => Promise<number | false>;
}

export default function SoalTampil({
  soal, jawaban, onJawab, tinjau = false, skorRaih, tampilkanStimulus = true, audio, examId,
}: {
  soal: SoalView;
  jawaban: Jawaban;
  onJawab?: (j: Jawaban) => void;
  tinjau?: boolean;
  skorRaih?: number | null;
  tampilkanStimulus?: boolean;
  audio?: AturanAudio;
  /** Wajib untuk soal LISAN (rute unggah rekaman per ujian). */
  examId?: string;
}) {
  const kunciTerpakai = !!onJawab && !tinjau;

  /* RUMUS DI JAWABAN (22 Sep 2026): siswa menyisipkan rumus matematika/kimia lewat palet — tersimpan sebagai `$…$`
     di teks jawaban, tampil sebagai rumus di pratinjau, layar koreksi, dan hasil. */
  const isianRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [paletJawaban, setPaletJawaban] = useState<{ awal: number | null; akhir: number | null } | null>(null);
  const bukaPaletJawaban = () => setPaletJawaban({ awal: isianRef.current?.selectionStart ?? null, akhir: isianRef.current?.selectionEnd ?? null });
  const teksJawaban = typeof jawaban === "string" ? jawaban : "";
  const sisipRumusJawaban = (rumus: string) => {
    const a = paletJawaban?.awal ?? teksJawaban.length, b = paletJawaban?.akhir ?? teksJawaban.length;
    const sebelum = teksJawaban.slice(0, a);
    onJawab?.(sebelum + (sebelum && !/\s$/.test(sebelum) ? " " : "") + rumus + teksJawaban.slice(b));
  };
  const pratinjauJawaban = /\$/.test(teksJawaban) ? (
    <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="label-kecil mb-1">Tampilan rumus</p>
      <TeksRumus teks={teksJawaban} className="text-sm text-gray-800" />
    </div>
  ) : null;
  const [mengunggah, setMengunggah] = useState(false);
  const berkasRef = useRef<HTMLInputElement>(null);
  const akarRef = useRef<HTMLDivElement>(null);
  const stimRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(audio);
  useEffect(() => { audioRef.current = audio; });

  useEffect(() => {
    const aturan = audioRef.current;
    const akar = akarRef.current;
    if (!akar || tinjau || !aturan || aturan.batas <= 0) return;
    for (const el of Array.from(akar.querySelectorAll("audio"))) {
      if (el.dataset.dibatasi) continue;
      el.dataset.dibatasi = "1";
      el.controls = false;
      el.removeAttribute("controls");
      el.preload = "auto";
      const diWacana = !!stimRef.current?.contains(el) && !!soal.stimulus;
      const kunci = diWacana ? `stim:${soal.stimulus!.id}` : soal.id;
      let sisa = Math.max(0, aturan.batas - (aturan.hitungan[kunci] ?? 0));
      const tombol = document.createElement("button");
      tombol.type = "button";
      tombol.className = "inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed";
      const tulis = (teks: string) => { tombol.textContent = teks; tombol.disabled = sisa <= 0 || !el.paused; };
      tulis(sisa > 0 ? `▶ Putar audio (sisa ${sisa}×)` : "Audio sudah diputar maksimal");
      tombol.onclick = async () => {
        if (!el.paused || sisa <= 0) return;
        tombol.disabled = true;
        const hasil = await audioRef.current?.minta({ questionId: soal.id, stimulusId: diWacana ? soal.stimulus!.id : undefined }).catch(() => false as const);
        if (hasil === false || hasil === undefined) { sisa = 0; tulis("Audio sudah diputar maksimal"); return; }
        sisa = hasil;
        el.currentTime = 0;
        el.play().catch(() => {});
        tulis("♪ Sedang diputar...");
      };
      el.onended = () => tulis(sisa > 0 ? `▶ Putar audio (sisa ${sisa}×)` : "Audio sudah diputar maksimal");
      el.insertAdjacentElement("afterend", tombol);
    }
  }, [soal.id, soal.pertanyaan, soal.stimulus, tinjau]);

  const kotak = (aktif: boolean, benar?: boolean, salah?: boolean) =>
    `w-full flex items-start gap-3 text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
      benar ? "bg-emerald-50 border-emerald-300 text-emerald-900"
      : salah ? "bg-red-50 border-red-300 text-red-800"
      : aktif ? "bg-primary-50 border-primary-300 text-primary-900"
      : "bg-white border-gray-200 text-gray-700 hover:border-primary-100"} ${kunciTerpakai ? "cursor-pointer" : "cursor-default"}`;
  const lencana = (aktif: boolean, benar?: boolean, salah?: boolean) =>
    `w-7 h-7 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border ${
      benar ? "bg-emerald-500 border-emerald-500 text-white"
      : salah ? "bg-red-500 border-red-500 text-white"
      : aktif ? "bg-primary-700 border-primary-700 text-white" : "border-gray-300 text-gray-400"}`;

  async function unggah(file: File) {
    setMengunggah(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "ujian-jawaban");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok && d.url) onJawab?.(d.url);
    } finally { setMengunggah(false); }
  }

  return (
    <div ref={akarRef} className="panel p-5">
      {soal.diperbarui && !tinjau ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
          Soal ini diperbaiki pengawas pukul {new Date(soal.diperbarui).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}. Periksa kembali jawaban Anda.
        </div>
      ) : null}
      {tampilkanStimulus && soal.stimulus?.konten ? (
        <div ref={stimRef} className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">{soal.stimulus.judul}</p>
          <HtmlSoal as="div" className="prose prose-sm max-w-none text-gray-700" html={soal.stimulus.konten} />
        </div>
      ) : null}

      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 rounded-lg bg-primary-900 text-white text-sm font-bold flex items-center justify-center shrink-0">{soal.nomor}</span>
        <div className="flex-1 min-w-0">
          <HtmlSoal as="div" className="prose prose-sm max-w-none text-primary-900 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:text-xs" html={soal.pertanyaan} />
          <p className="text-xs text-gray-400 mt-1">
            {soal.tipe === "PG_KOMPLEKS" ? "Pilih SEMUA jawaban yang benar" : soal.tipe === "BENAR_SALAH" ? "Tentukan Benar/Salah tiap pernyataan"
              : soal.tipe === "MENJODOHKAN" ? "Pasangkan tiap butir dengan pilihan di kanan" : soal.tipe === "SURVEI" ? "Tidak dinilai" : ""}
            {soal.skor ? ` · ${soal.skor} poin` : ""}
            {tinjau && skorRaih !== undefined && skorRaih !== null ? ` · diperoleh ${skorRaih}` : ""}
          </p>
        </div>
      </div>

      {/* ---------- PG & SURVEI: satu pilihan ---------- */}
      {(soal.tipe === "PG" || soal.tipe === "SURVEI") && (
        <div className="space-y-2">
          {soal.opsi.map(o => {
            const aktif = jawaban === o.kode;
            const benar = tinjau && soal.opsiBenar?.includes(o.kode);
            const salah = tinjau && aktif && !benar && soal.tipe !== "SURVEI";
            return (
              <button key={o.kode} type="button" disabled={!kunciTerpakai} onClick={() => onJawab?.(aktif ? null : o.kode)} className={kotak(aktif, benar, salah)}>
                <span className={lencana(aktif, benar, salah)}>{o.label ?? o.kode}</span>
                <HtmlSoal as="span" className="flex-1 prose prose-sm max-w-none [&_img]:max-w-full" html={o.teks} />
                {benar && <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />}
                {salah && <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- PG KOMPLEKS: banyak pilihan ---------- */}
      {soal.tipe === "PG_KOMPLEKS" && (
        <div className="space-y-2">
          {soal.opsi.map(o => {
            const dipilih = Array.isArray(jawaban) ? jawaban : [];
            const aktif = dipilih.includes(o.kode);
            const benar = tinjau && soal.opsiBenar?.includes(o.kode);
            const salah = tinjau && aktif && !benar;
            return (
              <button key={o.kode} type="button" disabled={!kunciTerpakai}
                onClick={() => onJawab?.(aktif ? dipilih.filter(k => k !== o.kode) : [...dipilih, o.kode])}
                className={kotak(aktif, benar, salah)}>
                <span className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center mt-0.5 ${aktif ? "bg-primary-700 border-primary-700" : "border-gray-300"}`}>
                  {aktif && <CheckCircle2 size={14} className="text-white" />}
                </span>
                <span className="font-bold text-xs w-4 mt-1">{o.label ?? o.kode}</span>
                <HtmlSoal as="span" className="flex-1 prose prose-sm max-w-none" html={o.teks} />
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- BENAR / SALAH ---------- */}
      {soal.tipe === "BENAR_SALAH" && (
        <div className="space-y-2">
          {soal.opsi.map((o, i) => {
            const j = (jawaban && typeof jawaban === "object" && !Array.isArray(jawaban)) ? (jawaban as Record<string, boolean | string>)[o.kode] : undefined;
            const kunci = tinjau ? soal.opsiBenar?.includes(o.kode) : undefined;
            return (
              <div key={o.kode} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                <HtmlSoal as="span" className="flex-1 min-w-[10rem] text-sm text-gray-700" html={o.teks} />
                {([true, false] as const).map(nilai => {
                  const aktif = j === nilai;
                  const benar = tinjau && kunci === nilai;
                  const salah = tinjau && aktif && kunci !== nilai;
                  return (
                    <button key={String(nilai)} type="button" disabled={!kunciTerpakai}
                      onClick={() => onJawab?.({ ...((jawaban && typeof jawaban === "object" && !Array.isArray(jawaban)) ? jawaban as Record<string, boolean> : {}), [o.kode]: nilai })}
                      className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
                        benar ? "bg-emerald-500 border-emerald-500 text-white" : salah ? "bg-red-500 border-red-500 text-white"
                        : aktif ? "bg-primary-700 border-primary-700 text-white" : "border-gray-300 text-gray-500 hover:border-primary-300"}`}>
                      {nilai ? KODE_BS.benar : KODE_BS.salah}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- MENJODOHKAN ---------- */}
      {soal.tipe === "MENJODOHKAN" && (
        <div className="space-y-2">
          {soal.opsi.map((o, i) => {
            const j = (jawaban && typeof jawaban === "object" && !Array.isArray(jawaban)) ? (jawaban as Record<string, string>)[o.kode] : "";
            const kunci = tinjau ? soal.kunci?.pasangan?.[o.kode] : undefined;
            const benar = tinjau && !!j && j === kunci;
            const salah = tinjau && !!j && j !== kunci;
            return (
              <div key={o.kode} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${benar ? "border-emerald-300 bg-emerald-50" : salah ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                <HtmlSoal as="span" className="flex-1 min-w-[10rem] text-sm text-gray-700" html={o.teks} />
                <select value={j ?? ""} disabled={!kunciTerpakai}
                  onChange={e => onJawab?.({ ...((jawaban && typeof jawaban === "object" && !Array.isArray(jawaban)) ? jawaban as Record<string, string> : {}), [o.kode]: e.target.value })}
                  className="input-field text-sm py-1.5 min-w-[12rem]">
                  <option value="">- pilih pasangan -</option>
                  {(soal.kanan ?? []).map(k => <option key={k.kode} value={k.kode}>{k.kode}. {k.teks.replace(/<[^>]+>/g, "")}</option>)}
                </select>
                {tinjau && kunci && <span className="text-xs text-gray-400">kunci: {kunci}</span>}
              </div>
            );
          })}
          {(soal.kanan ?? []).length > 0 && (
            <div className="text-xs text-gray-500 rounded-xl bg-gray-50 p-3 grid sm:grid-cols-2 gap-1">
              {(soal.kanan ?? []).map(k => <div key={k.kode}><span className="font-bold">{k.kode}.</span> <HtmlSoal as="span" html={k.teks} /></div>)}
            </div>
          )}
        </div>
      )}

      {/* ---------- ISIAN SINGKAT ---------- */}
      {soal.tipe === "ISIAN_SINGKAT" && (
        <div>
          <input ref={isianRef as RefObject<HTMLInputElement>} value={typeof jawaban === "string" ? jawaban : ""} disabled={!kunciTerpakai}
            onChange={e => onJawab?.(e.target.value)} placeholder="Ketik jawaban singkat"
            className="input-field w-full max-w-md" />
          {kunciTerpakai && <TombolRumus onClick={bukaPaletJawaban} className="mt-1.5" />}
          {pratinjauJawaban}
          {tinjau && soal.kunci?.jawaban?.length ? <p className="text-xs text-emerald-700 mt-1">Kunci: {soal.kunci.jawaban.join(" / ")}</p> : null}
        </div>
      )}

      {/* ---------- URAIAN ---------- */}
      {soal.tipe === "URAIAN" && (
        <div>
          <textarea ref={isianRef as RefObject<HTMLTextAreaElement>} value={typeof jawaban === "string" ? jawaban : ""} disabled={!kunciTerpakai}
            onChange={e => onJawab?.(e.target.value)} rows={6} placeholder="Tulis jawaban Anda"
            className="input-field w-full" />
          {kunciTerpakai && <TombolRumus onClick={bukaPaletJawaban} className="mt-1.5" />}
          {pratinjauJawaban}
          {tinjau && soal.kunci?.acuan ? <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">Jawaban acuan: {soal.kunci.acuan}</p> : null}
          {tinjau && soal.kunci?.rubrik ? <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">Pedoman penskoran: {soal.kunci.rubrik}</p> : null}
        </div>
      )}

      {/* ---------- JAWABAN LISAN (22 Sep 2026) — src/components/ujian/PerekamLisan.tsx ---------- */}
      {soal.tipe === "LISAN" && (
        examId && kunciTerpakai ? (
          <PerekamLisan examId={examId} questionId={soal.id} durasiMaks={soal.durasiMaks ?? 120}
            jawaban={typeof jawaban === "string" && jawaban ? jawaban : null} onTersimpan={url => onJawab?.(url)} aktif={kunciTerpakai} />
        ) : typeof jawaban === "string" && jawaban.startsWith("/api/ujian/lisan/") ? (
          <audio controls preload="none" src={jawaban} className="w-full" />
        ) : <p className="text-sm text-gray-400">{kunciTerpakai ? "Perekam tidak tersedia di halaman ini." : "Siswa merekam jawaban suaranya di soal ini."}</p>
      )}

      {/* ---------- SOAL INTERAKTIF (21 Sep 2026) — src/components/ujian/SoalInteraktif.tsx ---------- */}
      {soal.tipe === "TITIK_GAMBAR" && (
        soal.gambar ? (
          <TitikGambar gambar={soal.gambar} jumlah={soal.jumlahTitik ?? soal.kunci?.area?.length ?? 1}
            jawaban={Array.isArray(jawaban) ? jawaban.map(String) : []} onJawab={kunciTerpakai ? onJawab : undefined}
            area={tinjau ? soal.kunci?.area : undefined} />
        ) : <p className="text-sm text-gray-400">Gambar soal belum diunggah.</p>
      )}
      {soal.tipe === "SERET_LEPAS" && (
        soal.gambar ? (
          <SeretLepas gambar={soal.gambar} label={soal.opsi.map(o => ({ kode: o.kode, teks: o.teks }))}
            jawaban={jawaban && typeof jawaban === "object" && !Array.isArray(jawaban) ? Object.fromEntries(Object.entries(jawaban).map(([k, v]) => [k, String(v)])) : {}}
            onJawab={kunciTerpakai ? onJawab : undefined} area={tinjau ? soal.kunci?.area : undefined} />
        ) : <p className="text-sm text-gray-400">Gambar soal belum diunggah.</p>
      )}
      {soal.tipe === "URUTKAN" && (
        <Urutkan langkah={soal.opsi.map(o => ({ kode: o.kode, teks: o.teks }))}
          jawaban={Array.isArray(jawaban) ? jawaban.map(String) : null} onJawab={kunciTerpakai ? onJawab : undefined}
          urutanBenar={tinjau ? (soal.kunci?.urutan?.length ? soal.kunci.urutan : undefined) : undefined} />
      )}

      {/* ---------- UNGGAH ---------- */}
      {soal.tipe === "UNGGAH" && (
        <div className="flex flex-wrap items-center gap-3">
          {typeof jawaban === "string" && jawaban ? (
            <a href={jawaban} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary-700 underline">
              <FileText size={16} /> Berkas terunggah
            </a>
          ) : <span className="text-sm text-gray-400">Belum ada berkas</span>}
          {kunciTerpakai && (
            <>
              <input ref={berkasRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && unggah(e.target.files[0])} />
              <button type="button" disabled={mengunggah}
                onClick={() => {
                  // Galeri/berkas HP membuat halaman kehilangan fokus — bukan "pindah tab" (tenggang dilepas begitu kembali).
                  tahanPengawasan(60_000);
                  window.addEventListener("focus", () => setTimeout(lepasPengawasan, 1500), { once: true });
                  berkasRef.current?.click();
                }}
                className="btn-modal-cancel">
                {mengunggah ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {jawaban ? "Ganti berkas" : "Unggah berkas"}
              </button>
            </>
          )}
        </div>
      )}
      {kunciTerpakai && <PaletRumus open={!!paletJawaban} onClose={() => setPaletJawaban(null)} onSisip={sisipRumusJawaban} />}
    </div>
  );
}
