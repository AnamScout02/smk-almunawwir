import "server-only";
import { prisma } from "@/lib/prisma";
import { GURU_COLUMNS } from "@/lib/buku-induk-guru-columns";
import { normalizeBukuIndukText } from "@/lib/text";
import type { Prisma } from "@prisma/client";

/** Biodata GURU & STAF — satu pintu baca/tulis.
 *
 *  Sumbernya dua, tetapi hanya SATU yang berlaku per pegawai:
 *  - `Teacher` (32 akun guru) — kolom scalar + `bukuIndukData`, sama dengan Buku Induk Guru.
 *  - `BiodataPegawai` — cadangan untuk akun TAS yang belum punya baris Teacher. Begitu TU
 *    membuatkan baris Teacher-nya, isinya DIPINDAHKAN ke Teacher lalu barisnya dihapus
 *    (`bacaBiodataPegawai` melakukannya sendiri), jadi tidak pernah ada dua salinan hidup.
 *
 *  Baris Teacher TIDAK dibuat otomatis untuk staf TAS: 22 dari 36 pemanggil
 *  `prisma.teacher.findMany()` tidak menyaring `teacherStatus`, jadi staf non-guru akan
 *  bocor ke daftar pengampu, beban mengajar, dan cetakan pembagian mengajar.
 */

/** Kolom scalar `Teacher` yang boleh diajukan pegawai sendiri. NIP, mata pelajaran, status
 *  kepegawaian, tanggal mulai, dan jabatan struktural SENGAJA tidak termasuk — itu wewenang TU. */
export const PEGAWAI_TOP_FIELDS = [
  "phone", "birthPlace", "birthDate", "gender", "religion", "address", "education",
] as const;

export const PEGAWAI_TOP_LABELS: Record<string, string> = {
  phone: "No. HP/Telepon",
  birthPlace: "Tempat Lahir",
  birthDate: "Tanggal Lahir",
  gender: "Jenis Kelamin",
  religion: "Agama",
  address: "Alamat Lengkap",
  education: "Pendidikan Terakhir",
};

/** Kunci `bukuIndukData` yang tidak ditandai `isian` di GURU_COLUMNS tetapi tetap data pribadi
 *  (bukan administratif), jadi boleh diajukan sendiri. */
const EKSTRA_BUKU: Record<string, string> = {
  nik: "NIK",
  maritalStatus: "Status Kawin",
  spouseName: "Nama Pasangan",
  desa: "Desa/Kelurahan",
  kecamatan: "Kecamatan",
  kabupaten: "Kabupaten/Kota",
  province: "Provinsi",
};

/** Grup GURU_COLUMNS yang TIDAK boleh diajukan pegawai (dicatat TU saat pegawai keluar). */
const GRUP_TERLARANG = new Set(["Pindah / Keluar"]);

const isianBuku = GURU_COLUMNS.filter(c => c.isian && !GRUP_TERLARANG.has(c.group));

export const PEGAWAI_BUKU_FIELDS: string[] = [
  ...Object.keys(EKSTRA_BUKU),
  ...isianBuku.map(c => c.key),
];

export const PEGAWAI_FIELD_LABELS: Record<string, string> = {
  ...PEGAWAI_TOP_LABELS,
  ...EKSTRA_BUKU,
  ...Object.fromEntries(isianBuku.map(c => [c.key, c.label])),
};

export interface BiodataPegawaiHasil {
  /** "teacher" = tersimpan di Buku Induk Guru; "pegawai" = cadangan staf tanpa baris Teacher. */
  sumber: "teacher" | "pegawai";
  identitas: {
    nama: string;
    email: string;
    peran: string;
    nip: string | null;
    mapel: string | null;
    statusKepegawaian: string | null;
    jabatan: string[];
  };
  top: Record<string, string>;
  buku: Record<string, unknown>;
}

const isoTanggal = (v: unknown): string => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const teks = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

function topDariTeacher(t: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of PEGAWAI_TOP_FIELDS) out[k] = k === "birthDate" ? isoTanggal(t[k]) : teks(t[k]);
  return out;
}

export async function bacaBiodataPegawai(userId: string): Promise<BiodataPegawaiHasil | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true, role: true,
      teacher: {
        select: {
          id: true, nip: true, subject: true, teacherStatus: true, bukuIndukData: true,
          phone: true, birthPlace: true, birthDate: true, gender: true, religion: true,
          address: true, education: true,
          jabatan: { select: { jabatan: { select: { name: true } } } },
        },
      },
      staffJabatan: { select: { jabatan: { select: { name: true } } } },
      biodataPegawai: { select: { data: true } },
    },
  });
  if (!user) return null;

  const jabatanStaf = user.staffJabatan.map(j => j.jabatan.name);

  if (user.teacher) {
    const t = user.teacher;
    let buku = (t.bukuIndukData as Record<string, unknown>) ?? {};

    // Baris Teacher-nya baru dibuat TU sesudah pegawai mengisi cadangan → pindahkan sekali.
    const cadangan = user.biodataPegawai?.data as { top?: Record<string, string>; buku?: Record<string, unknown> } | undefined;
    if (cadangan) {
      const top = cadangan.top ?? {};
      buku = normalizeBukuIndukText({ ...(cadangan.buku ?? {}), ...buku }) as Record<string, unknown>;
      const scalar: Record<string, unknown> = {};
      for (const k of PEGAWAI_TOP_FIELDS) {
        const lama = k === "birthDate" ? isoTanggal(t[k]) : teks(t[k]);
        if (!lama && top[k]) scalar[k] = k === "birthDate" ? new Date(top[k]) : top[k];
      }
      await prisma.$transaction([
        prisma.teacher.update({
          where: { id: t.id },
          data: { ...scalar, bukuIndukData: buku as Prisma.InputJsonValue },
        }),
        prisma.biodataPegawai.delete({ where: { userId } }),
      ]);
      const segar = await prisma.teacher.findUnique({
        where: { id: t.id },
        select: {
          phone: true, birthPlace: true, birthDate: true, gender: true, religion: true,
          address: true, education: true,
        },
      });
      return {
        sumber: "teacher",
        identitas: {
          nama: user.name, email: user.email, peran: user.role, nip: t.nip, mapel: t.subject,
          statusKepegawaian: t.teacherStatus,
          jabatan: [...t.jabatan.map(j => j.jabatan.name), ...jabatanStaf],
        },
        top: topDariTeacher((segar ?? {}) as Record<string, unknown>),
        buku,
      };
    }

    return {
      sumber: "teacher",
      identitas: {
        nama: user.name, email: user.email, peran: user.role, nip: t.nip, mapel: t.subject,
        statusKepegawaian: t.teacherStatus,
        jabatan: [...t.jabatan.map(j => j.jabatan.name), ...jabatanStaf],
      },
      top: topDariTeacher(t as unknown as Record<string, unknown>),
      buku,
    };
  }

  const data = (user.biodataPegawai?.data as { top?: Record<string, string>; buku?: Record<string, unknown> }) ?? {};
  const top: Record<string, string> = {};
  for (const k of PEGAWAI_TOP_FIELDS) top[k] = teks(data.top?.[k]);
  return {
    sumber: "pegawai",
    identitas: {
      nama: user.name, email: user.email, peran: user.role, nip: null, mapel: null,
      statusKepegawaian: null, jabatan: jabatanStaf,
    },
    top,
    buku: data.buku ?? {},
  };
}

/** Menerapkan perubahan yang SUDAH disetujui TU ke sumber yang berlaku bagi pegawai itu. */
export async function terapkanBiodataPegawai(
  userId: string,
  topBaru: Record<string, unknown>,
  bukuBaru: Record<string, unknown>,
): Promise<void> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true, bukuIndukData: true },
  });

  if (teacher) {
    const scalar: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(topBaru)) {
      if (!(PEGAWAI_TOP_FIELDS as readonly string[]).includes(k)) continue;
      scalar[k] = k === "birthDate" ? (v ? new Date(String(v)) : null) : (v || null);
    }
    const gabung = normalizeBukuIndukText({
      ...((teacher.bukuIndukData as Record<string, unknown>) ?? {}),
      ...bukuBaru,
    });
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { ...scalar, bukuIndukData: gabung as Prisma.InputJsonValue },
    });
    return;
  }

  const lama = await prisma.biodataPegawai.findUnique({ where: { userId }, select: { data: true } });
  const isi = (lama?.data as { top?: Record<string, unknown>; buku?: Record<string, unknown> }) ?? {};
  const data = {
    top: { ...(isi.top ?? {}), ...topBaru },
    buku: normalizeBukuIndukText({ ...(isi.buku ?? {}), ...bukuBaru }),
  };
  await prisma.biodataPegawai.upsert({
    where: { userId },
    create: { userId, data: data as Prisma.InputJsonValue },
    update: { data: data as Prisma.InputJsonValue },
  });
}

/** Jumlah pengajuan perubahan biodata yang menunggu TU — SISWA + GURU/STAF dalam satu angka,
 *  karena keduanya diverifikasi di halaman yang sama (/dashboard/admin/verifikasi-data). */
export async function hitungPengajuanBiodata(): Promise<number> {
  const [siswa, pegawai] = await Promise.all([
    prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
    prisma.pegawaiEditRequest.count({ where: { status: "PENDING" } }),
  ]);
  return siswa + pegawai;
}
