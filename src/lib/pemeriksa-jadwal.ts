import "server-only";
import { prisma } from "@/lib/prisma";
import { weekTypesOverlap, weekLabel } from "@/lib/schedule-week";

/** Pemeriksa mutu JADWAL PELAJARAN — saudara kandung `pemeriksa-data.ts`.
 *
 * Lahir dari penelusuran manual 13 September 2026: awalnya terbaca "222 bentrok", lalu 67 setelah
 * kelas XII dikecualikan, dan barulah ketahuan bahwa SEMUA sisa itu sebenarnya KELAS GABUNGAN yang
 * memang disengaja (satu guru mengajar XI TKJ 1 + XI TKJ 2 sekaligus), bukan kesalahan. Menghitung
 * "bentrok" tanpa membedakan ketiga hal itu cuma melahirkan daftar yang tidak bisa dikerjakan.
 *
 * Karena itu pemeriksa ini memisahkan tiga hal yang selama ini tercampur:
 *
 *   1. BENTROK SUNGGUHAN — satu guru, satu jam, DUA MATA PELAJARAN BERBEDA. Mustahil dijalankan.
 *   2. KELAS GABUNGAN — satu guru, satu jam, MAPEL SAMA di dua kelas. Sah, asal mapelnya memang
 *      ditandai boleh digabung (`Subject.maxSharedTeacher` ≥ 2 — kolom yang SUDAH dipakai mesin
 *      penyusun jadwal, jadi menandainya di sini sekaligus memperbaiki hasil Generate berikutnya).
 *   3. JADWAL KELAS XII — sengaja dibuat sebagai formalitas karena kelas XII sedang PKL
 *      (keterangan user), jadi tabrakannya tidak perlu diperlakukan sebagai kesalahan.
 *
 * Yang TIDAK diperiksa di sini: kekurangan jam mengajar per penugasan — itu sudah ditangani
 * lengkap (beserta saran penggeseran slot) oleh `/api/admin/schedules/unscheduled`.
 */

export type Kategori = "kritis" | "penting" | "saran";

export interface ContohJadwal {
  /** classId salah satu pihak — untuk tautan ke jadwal kelasnya. */
  id: string | null;
  kiri: string;    // "XI TKJ 1 · Matematika"
  kanan: string;   // "XI TKJ 2 · Matematika" (kosong kalau temuannya bukan pasangan)
  waktu: string;   // "Senin 07:00–08:30 · Setiap Minggu"
  detail: string;
  /** Terisi hanya untuk temuan "Jadwal tidak cocok dengan Penugasan Mengajar" — bekal secukupnya
   * bagi halaman untuk menawarkan dua tombol perbaikan (samakan ke jadwal / samakan ke penugasan)
   * tanpa perlu bertanya balik ke server dulu. */
  perbaikanPenugasan?: {
    classId: string;
    subject: string;
    guruJadwalId: string;
    guruJadwalNama: string;
    guruPenugasanId: string | null;
    guruPenugasanNama: string | null;
  };
}

export interface TemuanJadwal {
  id: string;
  kategori: Kategori;
  judul: string;
  penjelasan: string;
  saran: string;
  jumlah: number;
  contoh: ContohJadwal[];
  /** Mapel yang temuannya bisa dituntaskan sekali klik dengan menandainya boleh kelas gabungan. */
  mapelGabungan?: { nama: string; jumlah: number }[];
}

const BATAS_CONTOH = 50;
const HARI_LABEL: Record<string, string> = {
  SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu",
};
/** Batas jam mengajar seminggu yang dipakai penyusun jadwal — dipakai ulang supaya sama. */
const BATAS_JAM_MINGGU = 56;

type BarisJadwal = {
  id: string; classId: string; teacherId: string | null; subject: string;
  day: string; startTime: string; endTime: string; weekType: string; scheduleType: string;
  class: { name: string; grade: number };
  teacher: { user: { name: string } } | null;
};

const menit = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const bertumpuk = (a: BarisJadwal, b: BarisJadwal) =>
  menit(a.startTime) < menit(b.endTime) && menit(b.startTime) < menit(a.endTime);

const waktuTeks = (s: BarisJadwal) =>
  `${HARI_LABEL[s.day] ?? s.day} ${s.startTime}–${s.endTime} · ${weekLabel(s.class.grade, s.weekType)}`;

const sisi = (s: BarisJadwal) => `${s.class.name} · ${s.subject}`;

function buat(
  batas: number, id: string, kategori: Kategori, judul: string, penjelasan: string, saran: string,
  items: ContohJadwal[], mapelGabungan?: { nama: string; jumlah: number }[],
): TemuanJadwal | null {
  if (items.length === 0) return null;
  return {
    id, kategori, judul, penjelasan, saran,
    jumlah: items.length, contoh: items.slice(0, batas),
    ...(mapelGabungan?.length ? { mapelGabungan } : {}),
  };
}

export interface HasilPemeriksaanJadwal {
  temuan: TemuanJadwal[];
  ringkasan: Record<Kategori, number>;
  totalJadwal: number;
  diperiksaPada: string;
}

export async function jalankanPemeriksaanJadwal(
  opts: { batasContoh?: number } = {},
): Promise<HasilPemeriksaanJadwal> {
  const batas = opts.batasContoh ?? BATAS_CONTOH;

  const [jadwal, mapel, kelas, penugasan] = await Promise.all([
    prisma.schedule.findMany({
      select: {
        id: true, classId: true, teacherId: true, subject: true, day: true,
        startTime: true, endTime: true, weekType: true, scheduleType: true,
        class: { select: { name: true, grade: true } },
        teacher: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.subject.findMany({ select: { name: true, maxSharedTeacher: true } }),
    prisma.class.findMany({ select: { id: true, name: true, grade: true } }),
    prisma.teachingAssignment.findMany({
      select: {
        classId: true, teacherId: true,
        subject: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);

  // Satu nama mapel bisa punya beberapa baris Subject (per tingkat/jurusan). Yang dipakai adalah
  // batas TERLONGGAR di antaranya — sama seperti cara penyusun jadwal membacanya.
  const batasGabung = new Map<string, number>();
  for (const m of mapel) {
    batasGabung.set(m.name, Math.max(batasGabung.get(m.name) ?? 1, m.maxSharedTeacher));
  }

  const bentrokMapelBeda: ContohJadwal[] = [];
  const gabunganBelumDitandai: ContohJadwal[] = [];
  const kelasDobel: ContohJadwal[] = [];
  const menyangkutKelas12: ContohJadwal[] = [];
  const hitungMapelGabung = new Map<string, number>();

  for (let i = 0; i < jadwal.length; i++) {
    for (let j = i + 1; j < jadwal.length; j++) {
      const a = jadwal[i], b = jadwal[j];
      // BLOK dan NONBLOK adalah DUA penyajian jadwal yang sama (NONBLOK khusus unggahan Dapodik) —
      // membandingkannya satu sama lain akan melaporkan bentrok yang tidak pernah terjadi.
      if (a.day !== b.day || a.scheduleType !== b.scheduleType) continue;
      if (!bertumpuk(a, b) || !weekTypesOverlap(a.weekType, b.weekType)) continue;

      if (a.classId === b.classId) {
        kelasDobel.push({
          id: a.classId, kiri: sisi(a), kanan: sisi(b), waktu: waktuTeks(a),
          detail: "Satu rombel tidak mungkin mengikuti dua pelajaran sekaligus.",
        });
        continue;
      }
      if (!a.teacherId || a.teacherId !== b.teacherId) continue;

      const guru = a.teacher?.user.name ?? "(guru tanpa nama)";
      const libatkan12 = a.class.grade === 12 || b.class.grade === 12;

      if (a.subject !== b.subject) {
        const c: ContohJadwal = {
          id: a.classId, kiri: sisi(a), kanan: sisi(b), waktu: waktuTeks(a),
          detail: `${guru} — dua mata pelajaran berbeda di jam yang sama.`,
        };
        if (libatkan12) menyangkutKelas12.push(c); else bentrokMapelBeda.push(c);
        continue;
      }

      // Mapel sama = kelas gabungan.
      if (libatkan12) continue; // jadwal kelas XII memang formalitas, tidak dihitung
      const c: ContohJadwal = {
        id: a.classId, kiri: sisi(a), kanan: sisi(b), waktu: waktuTeks(a),
        detail: `${guru} — mata pelajaran sama, kemungkinan besar memang kelas gabungan.`,
      };
      // Yang mapelnya sudah ditandai boleh digabung TIDAK dilaporkan di sini — jumlah kelas yang
      // ditumpuk baru diperiksa terhadap batasnya di blok "tumpukan" di bawah.
      if ((batasGabung.get(a.subject) ?? 1) < 2) {
        gabunganBelumDitandai.push(c);
        hitungMapelGabung.set(a.subject, (hitungMapelGabung.get(a.subject) ?? 0) + 1);
      }
    }
  }

  // Gabungan yang mapelnya SUDAH ditandai boleh digabung baru bermasalah kalau jumlah kelas yang
  // ditumpuk di satu jam melebihi batasnya — dihitung per (guru, hari, jam mulai, mapel).
  // Pengelompokan memakai jam MULAI yang sama persis — cukup karena jadwal sekolah ini memakai
  // slot jam baku yang seragam untuk semua kelas.
  const tumpukan = new Map<string, BarisJadwal[]>();
  for (const s of jadwal) {
    if (!s.teacherId) continue;
    const k = `${s.teacherId}|${s.day}|${s.startTime}|${s.subject}|${s.scheduleType}`;
    const daftar = tumpukan.get(k);
    if (daftar) daftar.push(s); else tumpukan.set(k, [s]);
  }
  const lewatBatas: ContohJadwal[] = [];
  for (const rombongan of tumpukan.values()) {
    const s = rombongan[0];
    const batasMapel = batasGabung.get(s.subject) ?? 1;
    if (batasMapel < 2 || rombongan.length <= batasMapel) continue;
    if (rombongan.some(r => r.class.grade === 12)) continue;
    lewatBatas.push({
      id: s.classId,
      kiri: rombongan.map(r => r.class.name).join(" + "),
      kanan: s.subject,
      waktu: waktuTeks(s),
      detail: `${rombongan.length} kelas sekaligus, padahal mata pelajaran ini ditandai maksimal ${batasMapel} kelas.`,
    });
  }

  // ── Aturan yang tidak berupa pasangan ──
  const tanpaGuru: ContohJadwal[] = jadwal
    .filter(s => !s.teacherId)
    .map(s => ({ id: s.classId, kiri: sisi(s), kanan: "", waktu: waktuTeks(s), detail: "Belum ada guru pengampu." }));

  const jamJanggal: ContohJadwal[] = jadwal
    .filter(s => menit(s.endTime) <= menit(s.startTime))
    .map(s => ({ id: s.classId, kiri: sisi(s), kanan: "", waktu: waktuTeks(s), detail: "Jam selesai tidak sesudah jam mulai." }));

  const punyaJadwal = new Set(jadwal.map(s => s.classId));
  const kelasKosong: ContohJadwal[] = kelas
    .filter(c => !punyaJadwal.has(c.id))
    .map(c => ({ id: c.id, kiri: c.name, kanan: "", waktu: "—", detail: "Belum punya satu pun baris jadwal." }));

  // Guru mengajar mapel yang bukan penugasannya di kelas itu — biasanya sisa jadwal lama yang
  // tidak ikut berubah saat Penugasan Mengajar diperbarui.
  const sahPenugasan = new Set(penugasan.map(p => `${p.classId}|${p.teacherId}|${p.subject.name}`));
  // Pemegang penugasan untuk tiap (kelas, mapel) — dipakai menawarkan "siapa seharusnya".
  const pemegang = new Map(penugasan.map(p => [
    `${p.classId}|${p.subject.name}`,
    { id: p.teacherId, nama: p.teacher.user.name },
  ]));
  const diluarPenugasan: ContohJadwal[] = jadwal
    .filter(s => s.teacherId && !sahPenugasan.has(`${s.classId}|${s.teacherId}|${s.subject}`))
    .map(s => {
      const punya = pemegang.get(`${s.classId}|${s.subject}`) ?? null;
      return {
        id: s.classId, kiri: sisi(s), kanan: s.teacher?.user.name ?? "—", waktu: waktuTeks(s),
        detail: punya
          ? `Di Penugasan Mengajar, mata pelajaran ini dipegang ${punya.nama}.`
          : "Belum ada Penugasan Mengajar sama sekali untuk mata pelajaran ini di kelas tersebut.",
        perbaikanPenugasan: {
          classId: s.classId,
          subject: s.subject,
          guruJadwalId: s.teacherId!,
          guruJadwalNama: s.teacher?.user.name ?? "—",
          guruPenugasanId: punya?.id ?? null,
          guruPenugasanNama: punya?.nama ?? null,
        },
      };
    });

  // Beban jam per minggu — jadwal BLOK kelas X/XI berjalan dua minggu bergantian, jadi baris
  // ber-weekType A/B hanya dihitung setengah.
  const bebanGuru = new Map<string, { nama: string; jam: number }>();
  for (const s of jadwal) {
    if (!s.teacherId || s.scheduleType !== "BLOK") continue;
    const durasi = (menit(s.endTime) - menit(s.startTime)) / 45; // 1 jam pelajaran = 45 menit
    const bobot = s.weekType === "SEMUA" ? 1 : 0.5;
    const e = bebanGuru.get(s.teacherId) ?? { nama: s.teacher?.user.name ?? "—", jam: 0 };
    e.jam += durasi * bobot;
    bebanGuru.set(s.teacherId, e);
  }
  const bebanBerlebih: ContohJadwal[] = [...bebanGuru.values()]
    .filter(g => g.jam > BATAS_JAM_MINGGU)
    .sort((a, b) => b.jam - a.jam)
    .map(g => ({
      id: null, kiri: g.nama, kanan: `${Math.round(g.jam)} jam pelajaran/minggu`, waktu: "—",
      detail: `Melebihi batas wajar ${BATAS_JAM_MINGGU} jam pelajaran per minggu.`,
    }));

  const temuan: (TemuanJadwal | null)[] = [
    buat(batas, "kelas-dobel", "kritis", "Satu kelas kebagian dua pelajaran di jam yang sama",
      "Rombel yang sama dijadwalkan mengikuti dua mata pelajaran sekaligus — salah satunya pasti tidak berjalan.",
      "Buka Jadwal Pelajaran kelas itu dan geser salah satu pelajaran ke jam kosong.",
      kelasDobel),

    buat(batas, "guru-mapel-beda", "kritis", "Guru mengajar dua mata pelajaran berbeda di jam yang sama",
      "Berbeda dengan kelas gabungan, ini mustahil dijalankan: satu guru tidak bisa mengajarkan dua materi berbeda di dua rombel pada jam yang sama.",
      "Geser salah satu pelajaran ke jam lain, atau serahkan ke guru pengampu lain lewat Penugasan Mengajar.",
      bentrokMapelBeda),

    buat(batas, "jam-janggal", "kritis", "Jam pelajaran tidak masuk akal",
      "Jam selesai sama dengan atau lebih awal daripada jam mulai — baris seperti ini tidak akan tampil benar di cetakan jadwal maupun jurnal mengajar.",
      "Perbaiki jam mulai/selesai baris tersebut di Jadwal Pelajaran.",
      jamJanggal),

    buat(batas, "gabungan-belum-ditandai", "penting", "Kelas gabungan yang belum didaftarkan",
      "Satu guru mengajar mata pelajaran YANG SAMA di dua rombel pada jam yang sama. Ini lazim dan sah (rombel kecil digabung), tapi mata pelajarannya belum ditandai boleh digabung — akibatnya terus terbaca sebagai bentrok, dan penyusun jadwal otomatis akan menghindarinya.",
      "Tandai mata pelajarannya sebagai boleh kelas gabungan lewat tombol di bawah. Sekali ditandai, temuan ini hilang dan mesin penyusun jadwal ikut menghormatinya.",
      gabunganBelumDitandai,
      [...hitungMapelGabung.entries()].sort((a, b) => b[1] - a[1]).map(([nama, jumlah]) => ({ nama, jumlah }))),

    buat(batas, "gabungan-lewat-batas", "penting", "Kelas gabungan melebihi batas yang ditetapkan",
      "Mata pelajaran ini boleh digabung, tapi jumlah rombel yang ditumpuk di satu jam melebihi batas yang disetel.",
      "Kurangi jumlah rombel di jam itu, atau naikkan batas mata pelajarannya kalau ruangan memang memuat.",
      lewatBatas),

    buat(batas, "tanpa-guru", "penting", "Baris jadwal belum punya guru pengampu",
      "Pelajaran terjadwal tapi tidak ada gurunya — tidak akan muncul di jurnal mengajar maupun rekap beban mengajar siapa pun.",
      "Isi guru pengampunya lewat Jadwal Pelajaran atau Penugasan Mengajar.",
      tanpaGuru),

    buat(batas, "diluar-penugasan", "penting", "Jadwal tidak cocok dengan Penugasan Mengajar",
      "Guru pada baris jadwal ini tidak punya Penugasan Mengajar untuk mata pelajaran di kelas tersebut. Akibatnya nyata: guru yang mengajar TIDAK bisa mengisi nilai & jurnal kelas itu (hak aksesnya berdasarkan Penugasan Mengajar), sementara guru yang tercatat di penugasan melihat kelas yang tidak diajarnya.",
      "Tentukan mana yang benar, lalu samakan lewat dua tombol di tiap baris: \"Jadwal yang benar\" memindahkan penugasan ke guru yang ada di jadwal; \"Penugasan yang benar\" mengganti guru pada baris jadwalnya.",
      diluarPenugasan),

    buat(batas, "beban-berlebih", "saran", "Beban mengajar melebihi batas wajar",
      `Jumlah jam pelajaran guru ini melebihi ${BATAS_JAM_MINGGU} jam per minggu — batas yang sama dipakai penyusun jadwal otomatis.`,
      "Sebar sebagian mata pelajaran ke guru lain lewat Penugasan Mengajar.",
      bebanBerlebih),

    buat(batas, "kelas-tanpa-jadwal", "saran", "Kelas belum punya jadwal sama sekali",
      "Rombel ini tidak punya satu pun baris jadwal — absensi per jam, jurnal mengajar, dan cetak jadwal kelasnya kosong.",
      "Susun jadwalnya lewat menu Jadwal Pelajaran (bisa dibuatkan otomatis lewat Generate).",
      kelasKosong),

    buat(batas, "kelas-12-formalitas", "saran", "Tabrakan yang menyangkut jadwal Kelas XII",
      "Kelas XII sedang PKL sehingga jadwalnya dibuat sebagai formalitas — tabrakan dengan kelas X/XI di sini memang disengaja dan tidak perlu dibereskan.",
      "Biarkan saja. Dicantumkan supaya angkanya tidak hilang begitu saja dari pemeriksaan.",
      menyangkutKelas12),
  ];

  const hasil = temuan.filter((t): t is TemuanJadwal => t !== null).sort((a, b) => {
    const urut: Record<Kategori, number> = { kritis: 0, penting: 1, saran: 2 };
    return urut[a.kategori] - urut[b.kategori] || b.jumlah - a.jumlah;
  });

  const ringkasan: Record<Kategori, number> = { kritis: 0, penting: 0, saran: 0 };
  for (const t of hasil) ringkasan[t.kategori] += t.jumlah;

  return { temuan: hasil, ringkasan, totalJadwal: jadwal.length, diperiksaPada: new Date().toISOString() };
}
