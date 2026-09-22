import { periksaButir, type Opsi, type Kunci } from "@/lib/soal";
import { rapikanKodeOpsi } from "@/lib/soal-kunci";
import { rapikanLevel } from "@/lib/kisi-kisi";

export interface ButirMasuk {
  tipe: string; pertanyaan: string; opsi: Opsi[]; kunci: Kunci | null;
  skor?: number; kd?: string | null; pembahasan?: string | null; stimulusId?: string | null;
  /** Kolom kisi-kisi — WAJIB ikut dibawa: PUT ujian menghapus & membuat ulang semua soal dari data ini. */
  materi?: string | null; indikator?: string | null; levelKognitif?: string | null;
}

const teksAtauNull = (v: unknown) => String(v ?? "").trim() || null;

/** Validasi + rapikan satu butir dari formulir/impor. Mengembalikan pesan kesalahan atau null. */
export function siapkanButir(b: ButirMasuk): { data: ButirMasuk; error: string | null } {
  const tipe = String(b.tipe || "PG");
  const opsi = rapikanKodeOpsi(Array.isArray(b.opsi) ? b.opsi : [], tipe)
    .map(o => ({ kode: o.kode, teks: String(o.teks ?? ""), ...(o.benar ? { benar: true } : {}) }));
  const data: ButirMasuk = {
    tipe, pertanyaan: String(b.pertanyaan ?? ""), opsi, kunci: b.kunci ?? null,
    skor: Math.max(0, Number(b.skor) || 1), kd: b.kd?.trim() || null,
    pembahasan: b.pembahasan?.trim() || null, stimulusId: b.stimulusId || null,
    materi: teksAtauNull(b.materi), indikator: teksAtauNull(b.indikator), levelKognitif: rapikanLevel(b.levelKognitif),
  };
  const masalah = periksaButir({ tipe, pertanyaan: data.pertanyaan, opsi, kunci: data.kunci });
  return { data, error: masalah.length ? masalah.join("; ") : null };
}

