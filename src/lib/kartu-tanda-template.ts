// Template desain Kartu Tanda — pola SAMA PERSIS dengan cover-template.ts (Desain Cover Absensi
// & Jurnal): admin upload gambar latar lalu drag-drop elemen di atasnya, disimpan sbg JSON di
// SiteSetting. Diperluas dari versi cover (yang cuma dukung teks) supaya juga dukung elemen
// FOTO (foto orangnya), QR (barcode identitas orangnya), dan SIGNATURE (QR TTD Kepala Sekolah
// yang sudah diupload di Konten Halaman > Kop Surat) — bukan cuma teks statis/dinamis.
// Kartu Tanda 2 sisi, jadi template-nya juga py 2 "sisi" terpisah (front/back), masing2 py
// gambar latar + daftar elemen sendiri.

export type KartuBoxType = "text" | "photo" | "qr" | "signature";

export type KartuTextField =
  | "static" | "nama" | "identifier" | "sub" | "kelas" | "jurusan" | "ttl" | "agama" | "jenisKartu"
  | "namaSekolah" | "alamatSekolah" | "kontakSekolah" | "namaKepsek";

export interface KartuBox {
  id: string;
  type: KartuBoxType;
  // --- khusus type "text" ---
  field?: KartuTextField;
  content?: string; // dipakai kalau field === "static"
  fontSize?: number;
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  // --- posisi & ukuran (persen dari kartu, anchor di TENGAH elemen — sama seperti cover editor) ---
  xPct: number;
  yPct: number;
  widthPct: number;
  // --- khusus type "photo"/"qr"/"signature" (bukan text) ---
  heightPct?: number;
  /** @deprecated pakai `shape` — masih dibaca sbg fallback utk template lama yg sudah kesimpan. */
  rounded?: boolean;
  shape?: "square" | "rounded" | "circle";
}

/** Resolve shape final elemen (foto/QR/TTD) — utamakan `shape` kalau ada, fallback ke `rounded`
 * lama (true -> "rounded", false/kosong -> "square") supaya template yg sudah disimpan sebelum
 * fitur "Bulat" ada tetap tampil sama seperti sebelumnya. */
export function resolveShape(box: KartuBox): "square" | "rounded" | "circle" {
  if (box.shape) return box.shape;
  return box.rounded ? "rounded" : "square";
}

export interface KartuSide {
  imageUrl: string;
  boxes: KartuBox[];
}

export interface KartuTemplate {
  front: KartuSide;
  back: KartuSide;
}

export const KARTU_TEMPLATE_KEY = "kartutanda.template";

export const FIELD_LABELS: Record<KartuTextField, string> = {
  static: "Teks Bebas",
  nama: "Nama Orang",
  identifier: "NIS / NIP / ID",
  sub: "Kelas & Jurusan / Jabatan (gabungan 1 baris)",
  kelas: "Kelas saja (khusus siswa, mis. X DPIB 1)",
  jurusan: "Jurusan saja (khusus siswa, mis. Desain Pemodelan dan Informasi Bangunan)",
  ttl: "Tempat, Tanggal Lahir (khusus siswa)",
  agama: "Agama (khusus siswa)",
  jenisKartu: "Jenis Kartu (Pelajar/Pendidik/Pegawai)",
  namaSekolah: "Nama Sekolah",
  alamatSekolah: "Alamat Sekolah",
  kontakSekolah: "Kontak Sekolah (telp/email)",
  namaKepsek: "Nama Kepala Sekolah",
};

export const BOX_TYPE_LABELS: Record<KartuBoxType, string> = {
  text: "Teks",
  photo: "Foto Orang",
  qr: "QR Identitas",
  signature: "QR TTD Kepala Sekolah",
};

export interface KartuFieldContext {
  nama: string; identifier: string; sub: string; kelas: string; jurusan: string; ttl: string; agama: string; jenisKartu: string;
  namaSekolah: string; alamatSekolah: string; kontakSekolah: string; namaKepsek: string;
}

export function resolveKartuText(box: KartuBox, ctx: KartuFieldContext): string {
  if (box.field === "static" || !box.field) return box.content ?? "";
  return ctx[box.field] ?? "";
}

export const DEFAULT_WIDTH_PCT = 60;
export const DEFAULT_PHOTO_SIZE = { widthPct: 26, heightPct: 34 };
export const DEFAULT_QR_SIZE = { widthPct: 16, heightPct: 21 };

export function emptyKartuTemplate(): KartuTemplate {
  return { front: { imageUrl: "", boxes: [] }, back: { imageUrl: "", boxes: [] } };
}
