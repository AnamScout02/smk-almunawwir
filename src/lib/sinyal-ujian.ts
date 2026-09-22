import "server-only";

/** SINYAL TINDAKAN PENGAWAS → LAYAR PESERTA (21 September 2026).
 *
 * Denyut peserta hanya mengetuk server tiap 20 detik, jadi Reset Login / Reset Waktu / Tambah Waktu / Kunci / Kumpulkan
 * baru terasa 0–20 detik kemudian — pengawas yang berdiri di samping siswa hanya melihat notifikasi sukses di layarnya
 * sendiri lalu me-refresh layar siswa (temuan user: "tidak langsung ter-action, harus hard refresh").
 *
 * Polanya long-poll: layar peserta membuka GET /api/student/exams/[id]/sinyal yang DITAHAN server sampai ada sinyal
 * (atau 25 detik). Tindakan pengawas memanggil `kirimSinyal` → permintaan yang tertahan langsung selesai → layar
 * peserta menjalankan denyut SEKARANG dan menerima keadaan terbarunya (tenggat, kunci, dikumpulkan, pesan, soal).
 * Menahan permintaan hampir tanpa biaya (tanpa kueri basis data selama menunggu).
 *
 * Aplikasi berjalan sebagai SATU proses Node (server.js standalone), jadi peta penunggu cukup di memori — disimpan di
 * `globalThis` supaya semua bundel route berbagi peta yang sama (pola singleton Prisma). */

type Penunggu = (jenis: "siswa" | "ujian") => void;
const g = globalThis as unknown as { __sinyalUjian?: Map<string, Set<Penunggu>> };
const peta: Map<string, Set<Penunggu>> = (g.__sinyalUjian ??= new Map());

/** Batas penunggu serentak — pengaman memori; lewat batas, peserta kembali mengandalkan denyut biasa. */
const BATAS_PENUNGGU = 6000;
let jumlahPenunggu = 0;

const kunciSiswa = (examId: string, studentId: string) => `${examId}:${studentId}`;
const kunciUjian = (examId: string) => `${examId}:*`;

function lepas(kunci: string, f: Penunggu) {
  const s = peta.get(kunci);
  if (!s) return;
  if (s.delete(f)) jumlahPenunggu = Math.max(0, jumlahPenunggu - 1);
  if (!s.size) peta.delete(kunci);
}

/** Bangunkan layar peserta. `studentIds` kosong/undefined = SEMUA peserta ujian itu (pesan umum, soal diperbaiki,
 * jadwal berubah) — klien menyebar denyutnya beberapa detik supaya server tidak dihantam serentak. */
export function kirimSinyal(examId: string, studentIds?: string[] | null) {
  const sasaran = studentIds?.length ? studentIds.map(s => kunciSiswa(examId, s)) : [kunciUjian(examId)];
  const jenis = studentIds?.length ? "siswa" : "ujian";
  for (const k of sasaran) for (const f of [...(peta.get(k) ?? [])]) f(jenis);
}

/** Tunggu sinyal untuk satu peserta (atau sinyal umum ujiannya) paling lama `ms`. */
export function tungguSinyal(examId: string, studentId: string, ms: number, batal?: AbortSignal): Promise<"siswa" | "ujian" | null> {
  if (jumlahPenunggu >= BATAS_PENUNGGU) return Promise.resolve(null);
  return new Promise(selesai => {
    const k1 = kunciSiswa(examId, studentId), k2 = kunciUjian(examId);
    let pewaktu: ReturnType<typeof setTimeout> | null = null;
    const akhiri = (hasil: "siswa" | "ujian" | null) => {
      if (pewaktu) clearTimeout(pewaktu);
      lepas(k1, f); lepas(k2, f);
      batal?.removeEventListener("abort", onBatal);
      selesai(hasil);
    };
    const f: Penunggu = jenis => akhiri(jenis);
    const onBatal = () => akhiri(null);
    for (const k of [k1, k2]) {
      let s = peta.get(k);
      if (!s) { s = new Set(); peta.set(k, s); }
      s.add(f); jumlahPenunggu += 1;
    }
    pewaktu = setTimeout(() => akhiri(null), ms);
    if (batal) { if (batal.aborted) akhiri(null); else batal.addEventListener("abort", onBatal); }
  });
}
