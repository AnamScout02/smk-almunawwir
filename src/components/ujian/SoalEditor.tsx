"use client";
import { useId, useRef, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Loader2, Music, Sigma } from "lucide-react";
import HtmlSoal from "@/components/ujian/HtmlSoal";
import PaletRumus, { TombolRumus } from "@/components/ujian/PaletRumus";
import Select from "@/components/admin/Select";
import { TIPE_SOAL, HURUF, type Opsi, type Kunci } from "@/lib/soal";
import { LEVEL_KOGNITIF } from "@/lib/kisi-kisi";
import { EditorGambarArea, EditorUrutkan } from "@/components/ujian/EditorInteraktif";
import { NAMA_VARIABEL, KETERANGAN_VARIABEL, CONTOH_VARIABEL, butirBerparameter, isiParameter } from "@/lib/soal-parameter";

/** Formulir SATU butir soal - dipakai Bank Soal dan penyusun ujian. Bentuk isiannya berubah
 * mengikuti tipe, tapi objek yang dihasilkan selalu {tipe, pertanyaan, opsi, kunci, skor, kd,
 * pembahasan, stimulusId, posisiKunci} sesuai `src/lib/soal.ts`. */

export interface ButirForm {
  tipe: string;
  pertanyaan: string;
  opsi: Opsi[];
  kunci: Kunci | null;
  skor: number;
  kd: string;
  /** Kisi-kisi (opsional) — lihat src/lib/kisi-kisi.ts. */
  materi?: string;
  indikator?: string;
  levelKognitif?: string;
  pembahasan: string;
  stimulusId: string | null;
  posisiKunci?: number | null;
}

export const BUTIR_KOSONG: ButirForm = {
  tipe: "PG", pertanyaan: "",
  opsi: ["A", "B", "C", "D", "E"].map(k => ({ kode: k, teks: "", benar: k === "A" })),
  kunci: null, skor: 1, kd: "", materi: "", indikator: "", levelKognitif: "", pembahasan: "", stimulusId: null, posisiKunci: null,
};

/** Susun opsi awal saat tipe berganti supaya formulirnya langsung masuk akal. */
function opsiAwal(tipe: string, lama: Opsi[]): Opsi[] {
  if (tipe === "PG" || tipe === "PG_KOMPLEKS" || tipe === "SURVEI") {
    const ada = lama.filter(o => /^[A-H]$/.test(o.kode));
    return ada.length >= 2 ? ada : ["A", "B", "C", "D", "E"].map(k => ({ kode: k, teks: "", benar: tipe === "PG" && k === "A" }));
  }
  if (tipe === "BENAR_SALAH") {
    const ada = lama.filter(o => /^\d+$/.test(o.kode));
    return ada.length ? ada : [{ kode: "1", teks: "", benar: true }, { kode: "2", teks: "", benar: false }];
  }
  if (tipe === "MENJODOHKAN") {
    const ada = lama.filter(o => /^\d+$/.test(o.kode));
    return ada.length ? ada.map(o => ({ kode: o.kode, teks: o.teks })) : [{ kode: "1", teks: "" }, { kode: "2", teks: "" }, { kode: "3", teks: "" }];
  }
  if (tipe === "URUTKAN") {
    const ada = lama.filter(o => /^\d+$/.test(o.kode));
    return ada.length >= 2 ? ada.map(o => ({ kode: o.kode, teks: o.teks })) : [{ kode: "1", teks: "" }, { kode: "2", teks: "" }, { kode: "3", teks: "" }];
  }
  return []; // TITIK_GAMBAR tanpa opsi; SERET_LEPAS: label dibuat bersama kotak di gambar
}

export default function SoalEditor({
  nilai, onChange, stimulusDaftar = [], tampilPosisiKunci = false, modeLive = false,
}: {
  nilai: ButirForm;
  onChange: (b: ButirForm) => void;
  stimulusDaftar?: { id: string; judul: string }[];
  tampilPosisiKunci?: boolean;
  /** Mode EDIT LIVE (ujian sudah dikerjakan): jenis soal, jumlah pilihan, wacana, dan kunci
   * posisi dikunci — hanya isi yang boleh diperbaiki, supaya jawaban & urutan acak peserta tidak
   * bergeser. Lihat /api/teacher/exams/[id]/soal-live. */
  modeLive?: boolean;
}) {
  const [mengunggah, setMengunggah] = useState(false);
  const berkasRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ButirForm>) => onChange({ ...nilai, ...patch });
  const setOpsi = (i: number, patch: Partial<Opsi>) => set({ opsi: nilai.opsi.map((o, k) => (k === i ? { ...o, ...patch } : o)) });

  /* PALET RUMUS (22 Sep 2026) — satu jendela untuk semua isian; rumus disisipkan di posisi kursor isian asalnya.
     Posisi kursor dibaca SAAT tombol ditekan (isian sudah kehilangan fokus, tapi selectionStart-nya masih tersimpan). */
  const uid = useId();
  const idIsian = (nama: string) => `${uid}-${nama}`;
  const [palet, setPalet] = useState<{ ambil: () => string; simpan: (v: string) => void; awal: number | null; akhir: number | null } | null>(null);
  const bukaPalet = (id: string, ambil: () => string, simpan: (v: string) => void) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    setPalet({ ambil, simpan, awal: el?.selectionStart ?? null, akhir: el?.selectionEnd ?? null });
  };
  const sisipRumus = (teks: string) => {
    if (!palet) return;
    const v = palet.ambil();
    const a = palet.awal ?? v.length, b = palet.akhir ?? v.length;
    const sebelum = v.slice(0, a);
    palet.simpan(sebelum + (sebelum && !/\s$/.test(sebelum) ? " " : "") + teks + v.slice(b));
  };
  const tombolRumusOpsi = (i: number) => (
    <button type="button" title="Sisipkan rumus" onClick={() => bukaPalet(idIsian(`opsi-${i}`), () => nilai.opsi[i]?.teks ?? "", v => setOpsi(i, { teks: v }))}
      className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg hover:bg-primary-50 transition"><Sigma size={14} /></button>
  );
  const pratinjauOpsi = (teks: string) => /\$|\\\(|\\\[/.test(teks) && (
    <HtmlSoal as="span" html={teks} className="block pl-8 text-sm text-gray-700" />
  );

  function gantiTipe(tipe: string) {
    const opsi = opsiAwal(tipe, nilai.opsi);
    let kunci: Kunci | null = null;
    if (tipe === "MENJODOHKAN") kunci = { kanan: nilai.kunci?.kanan?.length ? nilai.kunci.kanan : [{ kode: "A", teks: "" }, { kode: "B", teks: "" }, { kode: "C", teks: "" }], pasangan: nilai.kunci?.pasangan ?? {} };
    if (tipe === "ISIAN_SINGKAT") kunci = { jawaban: nilai.kunci?.jawaban ?? [""] };
    if (tipe === "URAIAN" || tipe === "UNGGAH") kunci = { acuan: nilai.kunci?.acuan ?? "", rubrik: nilai.kunci?.rubrik ?? "" };
    if (tipe === "LISAN") kunci = { acuan: nilai.kunci?.acuan ?? "", rubrik: nilai.kunci?.rubrik ?? "", durasiMaks: nilai.kunci?.durasiMaks ?? 120 };
    if (tipe === "TITIK_GAMBAR" || tipe === "SERET_LEPAS") kunci = { gambar: nilai.kunci?.gambar ?? "", area: [] };
    if (tipe === "URUTKAN") kunci = { urutan: opsi.map(o => o.kode) };
    set({ tipe, opsi, kunci });
  }

  async function sisipkanMedia(file: File) {
    setMengunggah(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "soal");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) return;
      const tag = file.type.startsWith("audio/")
        ? `<p><audio controls src="${d.url}"></audio></p>`
        : `<p><img src="${d.url}" alt="" style="max-width:100%" /></p>`;
      set({ pertanyaan: (nilai.pertanyaan || "") + "\n" + tag });
    } finally { setMengunggah(false); }
  }

  const tambahOpsi = () => {
    if (nilai.tipe === "BENAR_SALAH" || nilai.tipe === "MENJODOHKAN") {
      set({ opsi: [...nilai.opsi, { kode: String(nilai.opsi.length + 1), teks: "", ...(nilai.tipe === "BENAR_SALAH" ? { benar: true } : {}) }] });
    } else {
      const kode = HURUF[nilai.opsi.length]; if (!kode) return;
      set({ opsi: [...nilai.opsi, { kode, teks: "" }] });
    }
  };
  const hapusOpsi = (i: number) => {
    const sisa = nilai.opsi.filter((_, k) => k !== i);
    const ulang = (nilai.tipe === "BENAR_SALAH" || nilai.tipe === "MENJODOHKAN")
      ? sisa.map((o, k) => ({ ...o, kode: String(k + 1) }))
      : sisa.map((o, k) => ({ ...o, kode: HURUF[k] }));
    set({ opsi: ulang });
  };

  const kanan = nilai.kunci?.kanan ?? [];
  const setKanan = (daftar: { kode: string; teks: string }[]) => set({ kunci: { ...(nilai.kunci ?? {}), kanan: daftar } });
  const setPasangan = (kiri: string, k: string) => set({ kunci: { ...(nilai.kunci ?? {}), pasangan: { ...(nilai.kunci?.pasangan ?? {}), [kiri]: k } } });

  return (
    <div className="space-y-4">
      {modeLive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
          <strong>Perbaikan live.</strong> Ujian ini sudah dikerjakan peserta, jadi yang bisa diubah hanya teks soal,
          teks pilihan, kunci, skor, KD, dan pembahasan. Jenis soal dan jumlah pilihan dikunci supaya jawaban peserta
          tidak bergeser. Kalau kunci/skor diubah, pengerjaan yang sudah dikumpulkan otomatis dinilai ulang.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="label-field">Jenis Soal</label>
          {modeLive ? (
            <div className="input-field bg-gray-50 text-gray-500">{TIPE_SOAL.find(t => t.value === nilai.tipe)?.label ?? nilai.tipe}</div>
          ) : (
            <Select value={nilai.tipe} onChange={gantiTipe} options={TIPE_SOAL.map(t => ({ value: t.value, label: t.label }))} />
          )}
          <p className="text-xs text-gray-400 mt-1">{TIPE_SOAL.find(t => t.value === nilai.tipe)?.keterangan}</p>
        </div>
        <div>
          <label className="label-field">Skor</label>
          <input type="number" min={0} step={0.5} value={nilai.skor} onChange={e => set({ skor: Number(e.target.value) })} className="input-field w-full" />
        </div>
        <div>
          <label className="label-field">KD</label>
          <input value={nilai.kd} onChange={e => set({ kd: e.target.value })} placeholder="mis. 3.1" className="input-field w-full" />
        </div>
      </div>

      {!modeLive && (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label-field">Materi</label>
            <input value={nilai.materi ?? ""} onChange={e => set({ materi: e.target.value })} placeholder="mis. Teks prosedur" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Indikator Soal</label>
            <input value={nilai.indikator ?? ""} onChange={e => set({ indikator: e.target.value })} placeholder="Siswa dapat ..." className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Level Kognitif</label>
            <Select value={nilai.levelKognitif ?? ""} onChange={v => set({ levelKognitif: v })} options={[{ value: "", label: "— belum diisi —" }, ...LEVEL_KOGNITIF]} />
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label-field mb-0">Pertanyaan</label>
          <div className="flex items-center gap-2">
            <input ref={berkasRef} type="file" accept="image/*,audio/*" className="hidden" onChange={e => e.target.files?.[0] && sisipkanMedia(e.target.files[0])} />
            <button type="button" onClick={() => berkasRef.current?.click()} disabled={mengunggah}
              className="text-xs flex items-center gap-1 text-primary-700 hover:underline disabled:opacity-40">
              {mengunggah ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Sisipkan gambar
            </button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={() => berkasRef.current?.click()} disabled={mengunggah}
              className="text-xs flex items-center gap-1 text-primary-700 hover:underline disabled:opacity-40">
              <Music size={12} /> Audio listening
            </button>
            <span className="text-gray-300">|</span>
            <TombolRumus onClick={() => bukaPalet(idIsian("pertanyaan"), () => nilai.pertanyaan || "", v => set({ pertanyaan: v }))} />
          </div>
        </div>
        <textarea id={idIsian("pertanyaan")} value={nilai.pertanyaan} onChange={e => set({ pertanyaan: e.target.value })} rows={4}
          placeholder="Tulis pertanyaan. Boleh memakai HTML sederhana (<b>, <sup>, <br>, <img>)." className="input-field w-full font-mono text-xs" />
        <p className="text-xs text-gray-400 mt-1">
          Rumus: tekan <b>Σ Rumus</b> (palet simbol matematika &amp; kimia), atau tulis di antara tanda $, mis.{" "}
          <code className="text-primary-700">{String.raw`$x^2 + \sqrt{y}$`}</code>, <code className="text-primary-700">{String.raw`$\frac{1}{2}$`}</code>, kimia{" "}
          <code className="text-primary-700">{String.raw`$\ce{H2SO4}$`}</code>. Berlaku juga di pilihan jawaban, kunci, dan jawaban acuan.
        </p>
        {/* SOAL BERPARAMETER (21 Sep 2026) — src/lib/soal-parameter.ts */}
        <details className="mt-1 text-xs text-gray-500">
          <summary className="cursor-pointer font-semibold text-primary-700">Soal berparameter (angka berbeda tiap siswa)</summary>
          <p className="mt-1">
            Tulis variabel di soal, pilihan, kunci isian, jawaban acuan, atau pedoman — tiap siswa melihat angkanya sendiri, dan
            kunci isian dinilai per siswa. Boleh berhitung: <code className="text-primary-700">{"{ABSEN*4}"}</code>,{" "}
            <code className="text-primary-700">{"{(ABSEN*4)+1}"}</code>. Contoh: <code className="text-primary-700">{"192.168.{ABSEN}.0/24"}</code>.
          </p>
          <ul className="mt-1 space-y-0.5">
            {NAMA_VARIABEL.map(n => <li key={n}><code className="text-primary-700">{`{${n}}`}</code> — {KETERANGAN_VARIABEL[n]}</li>)}
          </ul>
        </details>
        {(() => {
          const salah = [...`${nilai.pertanyaan} ${nilai.opsi.map(o => o.teks).join(" ")} ${(nilai.kunci?.jawaban ?? []).join(" ")} ${nilai.kunci?.acuan ?? ""}`.matchAll(/\{([A-Z][A-Z0-9]*)[^}]*\}/g)]
            .map(m => m[1]).filter(n => n.length >= 3 && !(NAMA_VARIABEL as readonly string[]).includes(n)); // {A}{B} rumus LaTeX bukan variabel
          return salah.length ? <p className="mt-1 text-xs font-semibold text-red-600">Variabel tidak dikenal: {[...new Set(salah)].map(n => `{${n}}`).join(", ")} — pakai {NAMA_VARIABEL.map(n => `{${n}}`).join(", ")}.</p> : null;
        })()}
        {butirBerparameter(nilai) && (
          <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
            Pratinjau untuk siswa contoh (ABSEN {CONTOH_VARIABEL.ABSEN}, NIS2 {CONTOH_VARIABEL.NIS2}, ACAK {CONTOH_VARIABEL.ACAK}):{" "}
            <span className="font-medium">{isiParameter(nilai.pertanyaan.replace(/<[^>]+>/g, " "), CONTOH_VARIABEL).slice(0, 220)}</span>
            {(nilai.kunci?.jawaban ?? []).length > 0 && <> · kunci: <span className="font-medium">{(nilai.kunci?.jawaban ?? []).map(j => isiParameter(j, CONTOH_VARIABEL)).join(" | ")}</span></>}
          </p>
        )}
        {/<[a-z]|\$|\\\(|\\\[/i.test(nilai.pertanyaan) && (
          <HtmlSoal className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-3 prose prose-sm max-w-none [&_img]:max-w-xs" html={nilai.pertanyaan} />
        )}
      </div>

      {stimulusDaftar.length > 0 && !modeLive && (
        <div>
          <label className="label-field">Wacana / stimulus bersama <span className="text-gray-400 font-normal">(opsional - soal se-wacana tidak dipisah saat diacak)</span></label>
          <Select value={nilai.stimulusId ?? ""} onChange={v => set({ stimulusId: v || null })} placeholder="Tanpa wacana"
            options={[{ value: "", label: "Tanpa wacana" }, ...stimulusDaftar.map(s => ({ value: s.id, label: s.judul }))]} />
        </div>
      )}

      {/* ---------- pilihan: PG / PG KOMPLEKS / SURVEI ---------- */}
      {(nilai.tipe === "PG" || nilai.tipe === "PG_KOMPLEKS" || nilai.tipe === "SURVEI") && (
        <div>
          <label className="label-field">Pilihan jawaban {nilai.tipe !== "SURVEI" && <span className="text-gray-400 font-normal">- tandai yang benar</span>}</label>
          <div className="space-y-2">
            {nilai.opsi.map((o, i) => (
              <div key={o.kode}>
              <div className="flex items-center gap-2">
                {nilai.tipe !== "SURVEI" && (
                  <input type={nilai.tipe === "PG" ? "radio" : "checkbox"} name="benar" checked={!!o.benar}
                    onChange={() => nilai.tipe === "PG"
                      ? set({ opsi: nilai.opsi.map((x, k) => ({ ...x, benar: k === i })) })
                      : setOpsi(i, { benar: !o.benar })}
                    className="w-4 h-4 accent-[#1B2B6B]" title="Jawaban benar" />
                )}
                <span className="w-6 text-sm font-bold text-primary-900">{o.kode}</span>
                <input id={idIsian(`opsi-${i}`)} value={o.teks} onChange={e => setOpsi(i, { teks: e.target.value })} className="input-field flex-1" placeholder={`Pilihan ${o.kode}`} />
                {tombolRumusOpsi(i)}
                <button type="button" hidden={modeLive} onClick={() => hapusOpsi(i)} disabled={nilai.opsi.length <= 2} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg disabled:opacity-30"><Trash2 size={14} /></button>
              </div>
              {pratinjauOpsi(o.teks)}
              </div>
            ))}
          </div>
          {nilai.opsi.length < HURUF.length && (
            <button type="button" hidden={modeLive} onClick={tambahOpsi} className="mt-2 text-xs flex items-center gap-1 text-primary-700 hover:underline"><Plus size={12} /> Tambah pilihan</button>
          )}
        </div>
      )}

      {/* ---------- BENAR / SALAH ---------- */}
      {nilai.tipe === "BENAR_SALAH" && (
        <div>
          <label className="label-field">Pernyataan <span className="text-gray-400 font-normal">- pilih kuncinya</span></label>
          <div className="space-y-2">
            {nilai.opsi.map((o, i) => (
              <div key={o.kode} className="flex items-center gap-2">
                <span className="w-5 text-xs font-bold text-gray-400">{o.kode}.</span>
                <input id={idIsian(`opsi-${i}`)} value={o.teks} onChange={e => setOpsi(i, { teks: e.target.value })} className="input-field flex-1" placeholder="Pernyataan" />
                {tombolRumusOpsi(i)}
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {([true, false] as const).map(v => (
                    <button key={String(v)} type="button" onClick={() => setOpsi(i, { benar: v })}
                      className={`px-3 py-1.5 text-xs font-semibold ${!!o.benar === v ? "bg-primary-700 text-white" : "bg-white text-gray-500"}`}>
                      {v ? "Benar" : "Salah"}
                    </button>
                  ))}
                </div>
                <button type="button" hidden={modeLive} onClick={() => hapusOpsi(i)} disabled={nilai.opsi.length <= 1} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg disabled:opacity-30"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" hidden={modeLive} onClick={tambahOpsi} className="mt-2 text-xs flex items-center gap-1 text-primary-700 hover:underline"><Plus size={12} /> Tambah pernyataan</button>
        </div>
      )}

      {/* ---------- MENJODOHKAN ---------- */}
      {nilai.tipe === "MENJODOHKAN" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label-field">Butir kiri + pasangannya</label>
            <div className="space-y-2">
              {nilai.opsi.map((o, i) => (
                <div key={o.kode} className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold text-gray-400">{o.kode}.</span>
                  <input id={idIsian(`opsi-${i}`)} value={o.teks} onChange={e => setOpsi(i, { teks: e.target.value })} className="input-field flex-1" placeholder="Butir" />
                  {tombolRumusOpsi(i)}
                  <div className="w-24 shrink-0"><Select value={nilai.kunci?.pasangan?.[o.kode] ?? ""} onChange={v => setPasangan(o.kode, v)} placeholder="-"
                    options={[{ value: "", label: "-" }, ...kanan.map(k => ({ value: k.kode, label: k.kode }))]} /></div>
                  <button type="button" hidden={modeLive} onClick={() => hapusOpsi(i)} disabled={nilai.opsi.length <= 2} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" hidden={modeLive} onClick={tambahOpsi} className="mt-2 text-xs flex items-center gap-1 text-primary-700 hover:underline"><Plus size={12} /> Tambah butir</button>
          </div>
          <div>
            <label className="label-field">Pilihan kanan <span className="text-gray-400 font-normal">(boleh lebih banyak dari butir kiri, sebagai pengecoh)</span></label>
            <div className="space-y-2">
              {kanan.map((k, i) => (
                <div key={k.kode} className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold text-gray-400">{k.kode}</span>
                  <input value={k.teks} onChange={e => setKanan(kanan.map((x, j) => (j === i ? { ...x, teks: e.target.value } : x)))} className="input-field flex-1" placeholder="Pilihan" />
                  <button type="button" hidden={modeLive} onClick={() => setKanan(kanan.filter((_, j) => j !== i).map((x, j) => ({ ...x, kode: HURUF[j] })))} disabled={kanan.length <= 2} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {kanan.length < HURUF.length && (
              <button type="button" hidden={modeLive} onClick={() => setKanan([...kanan, { kode: HURUF[kanan.length], teks: "" }])} className="mt-2 text-xs flex items-center gap-1 text-primary-700 hover:underline"><Plus size={12} /> Tambah pilihan kanan</button>
            )}
          </div>
        </div>
      )}

      {/* ---------- ISIAN SINGKAT ---------- */}
      {/* ---------- SOAL INTERAKTIF (21 Sep 2026) ---------- */}
      {(nilai.tipe === "TITIK_GAMBAR" || nilai.tipe === "SERET_LEPAS") && (
        <EditorGambarArea tipe={nilai.tipe} terkunci={modeLive}
          gambar={nilai.kunci?.gambar ?? ""} area={nilai.kunci?.area ?? []} label={nilai.opsi}
          onChange={p => set({
            ...(p.opsi ? { opsi: p.opsi } : {}),
            kunci: { ...(nilai.kunci ?? {}), ...(p.gambar !== undefined ? { gambar: p.gambar } : {}), ...(p.area ? { area: p.area } : {}) },
          })} />
      )}
      {nilai.tipe === "URUTKAN" && (
        <EditorUrutkan langkah={nilai.opsi} terkunci={modeLive}
          onChange={opsi => set({ opsi, kunci: { ...(nilai.kunci ?? {}), urutan: opsi.map(o => o.kode) } })} />
      )}

      {nilai.tipe === "ISIAN_SINGKAT" && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="label-field">Jawaban yang diterima <span className="text-gray-400 font-normal">- satu per baris; tidak peka huruf besar/kecil</span></label>
            <TombolRumus onClick={() => bukaPalet(idIsian("isian"), () => (nilai.kunci?.jawaban ?? []).join("\n"), v => set({ kunci: { ...(nilai.kunci ?? {}), jawaban: v.split("\n") } }))} />
          </div>
          <textarea id={idIsian("isian")} value={(nilai.kunci?.jawaban ?? []).join("\n")} rows={3}
            onChange={e => set({ kunci: { ...(nilai.kunci ?? {}), jawaban: e.target.value.split("\n") } })}
            className="input-field w-full" placeholder={"56\nlima puluh enam"} />
        </div>
      )}

      {/* ---------- URAIAN / UNGGAH ---------- */}
      {nilai.tipe === "LISAN" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={idIsian("durasi")} className="label-field">Lama rekaman maksimal (detik)</label>
            <input id={idIsian("durasi")} type="number" min={15} max={600} step={15} value={nilai.kunci?.durasiMaks ?? 120}
              onChange={e => set({ kunci: { ...(nilai.kunci ?? {}), durasiMaks: Math.min(600, Math.max(15, Number(e.target.value) || 120)) } })}
              className="input-field w-full" />
          </div>
          <p className="self-end text-xs text-gray-500">Siswa merekam suaranya di browser (butuh mikrofon &amp; alamat HTTPS). Rekaman hanya bisa diputar
            siswa itu sendiri dan guru yang berhak — tidak bisa dibuka lewat alamat publik.</p>
        </div>
      )}
      {(nilai.tipe === "URAIAN" || nilai.tipe === "UNGGAH" || nilai.tipe === "LISAN") && (
        <div className="grid gap-3 md:grid-cols-2">
          {/* 21 September 2026: jawaban acuan & pedoman penskoran dipisah — sama dengan kolom Kunci Jawaban & Pedoman
              Penskoran di template Excel. Tercetak di Kartu Soal, tampil di layar Koreksi; tidak dikirim ke siswa saat ujian. */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="label-field">Jawaban acuan <span className="text-gray-400 font-normal">(hanya dilihat guru)</span></label>
              <TombolRumus onClick={() => bukaPalet(idIsian("acuan"), () => nilai.kunci?.acuan ?? "", v => set({ kunci: { ...(nilai.kunci ?? {}), acuan: v } }))} />
            </div>
            <textarea id={idIsian("acuan")} value={nilai.kunci?.acuan ?? ""} rows={4} onChange={e => set({ kunci: { ...(nilai.kunci ?? {}), acuan: e.target.value } })}
              className="input-field w-full" placeholder={nilai.tipe === "UNGGAH" ? "Gambaran hasil yang diharapkan" : "Poin-poin / contoh jawaban yang diharapkan"} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="label-field">Pedoman penskoran</label>
              <TombolRumus onClick={() => bukaPalet(idIsian("rubrik"), () => nilai.kunci?.rubrik ?? "", v => set({ kunci: { ...(nilai.kunci ?? {}), rubrik: v } }))} />
            </div>
            <textarea id={idIsian("rubrik")} value={nilai.kunci?.rubrik ?? ""} rows={4} onChange={e => set({ kunci: { ...(nilai.kunci ?? {}), rubrik: e.target.value } })}
              className="input-field w-full" placeholder="Kriteria & skor, mis. Tujuan tepat (4); langkah urut (6)" />
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label-field">Pembahasan <span className="text-gray-400 font-normal">(opsional)</span></label>
          <input value={nilai.pembahasan} onChange={e => set({ pembahasan: e.target.value })} className="input-field w-full" />
        </div>
        {tampilPosisiKunci && !modeLive && (
          <div>
            <label className="label-field">Kunci posisi <span className="text-gray-400 font-normal">(nomor tetap saat diacak, kosong = ikut diacak)</span></label>
            <input type="number" min={1} value={nilai.posisiKunci ?? ""} onChange={e => set({ posisiKunci: e.target.value ? Number(e.target.value) : null })} className="input-field w-full" placeholder="mis. 1 untuk listening, 40 untuk uraian terakhir" />
          </div>
        )}
      </div>
      <PaletRumus open={!!palet} onClose={() => setPalet(null)} onSisip={sisipRumus} />
    </div>
  );
}
