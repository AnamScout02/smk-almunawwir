import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { tanggalDari } from "@/lib/pkl-server";
import { JENIS_SURAT_PKL, KEPERLUAN_TUGAS, isiSuratPkl, type JenisSuratPkl } from "@/lib/pkl-surat";

/** Isian formulir Surat PKL — disimpan di `SuratPkl.data` supaya surat bisa dibuka lagi untuk diubah. */
export type IsianSuratPkl = {
  jenis: JenisSuratPkl; tanggal: string; mitraIds: string[]; studentIds: string[];
  mulai?: string; selesai?: string; lamaBulan?: number | null;
  guruIds?: string[]; keperluan?: string; berangkat?: string; kembali?: string; jam?: string; transportasi?: string; sumberBiaya?: string; withSppd?: boolean;
};

type Gagal = { galat: string; status: number };
type Siap = {
  isian: IsianSuratPkl; tanggal: Date; namaMitra: string; perihal: string; klasifikasi: string;
  tugas?: { data: { maksud: string; dasar: string; tempat: string; tempat2: string | null; tempat3: string | null; jam: string | null; tanggalBerangkat: Date; tanggalKembali: Date; transportasi: string | null; sumberBiaya: string | null; withSppd: boolean; withLaporan: boolean; keterangan: string }; pegawai: { teacherId: string; nama: string; nip: string | null; jabatan: string; peran: string; urutan: number }[] };
  surat?: { pihak: string; content: string; keterangan: string };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Memeriksa isian dan menyusun isi surat — SATU pintu untuk membuat (POST) dan mengubah (PUT), supaya keduanya tidak
 *  pernah berbeda. `jenisTetap` dipakai saat mengubah: jenis tidak boleh berganti karena kode klasifikasinya ada di nomor. */
export async function siapkanSuratPkl(b: Record<string, unknown>, jenisTetap?: JenisSuratPkl): Promise<Siap | Gagal> {
  const jenis = (jenisTetap ?? (typeof b.jenis === "string" && b.jenis in JENIS_SURAT_PKL ? b.jenis : "")) as JenisSuratPkl | "";
  if (!jenis) return { galat: "Jenis surat tidak dikenal.", status: 400 };
  const tanggal = tanggalDari(b.tanggal) ?? tanggalDari(new Date(Date.now() + 7 * 3600_000).toISOString())!;
  const mitraIds = Array.isArray(b.mitraIds) ? [...new Set(b.mitraIds.filter((x): x is string => typeof x === "string" && !!x))].slice(0, 3) : [];
  const studentIds = Array.isArray(b.studentIds) ? [...new Set(b.studentIds.filter((x): x is string => typeof x === "string"))].slice(0, 200) : [];
  if (!mitraIds.length) return { galat: "Pilih DUDI tujuan surat.", status: 400 };
  const dudi = await prisma.industryPartner.findMany({ where: { id: { in: mitraIds } }, select: { id: true, name: true, address: true, pimpinanJabatan: true, kecamatan: true } });
  if (dudi.length !== mitraIds.length) return { galat: "DUDI tidak ditemukan.", status: 404 };
  const urut = mitraIds.map(id => dudi.find(d => d.id === id)!);
  const info = JENIS_SURAT_PKL[jenis];

  if (jenis === "TUGAS") {
    const keperluan = typeof b.keperluan === "string" && KEPERLUAN_TUGAS[b.keperluan] ? b.keperluan : "";
    const guruIds = Array.isArray(b.guruIds) ? [...new Set(b.guruIds.filter((x): x is string => typeof x === "string"))].slice(0, 10) : [];
    const berangkat = tanggalDari(b.berangkat), kembali = tanggalDari(b.kembali) ?? berangkat;
    if (!keperluan || !guruIds.length || !berangkat || !kembali) return { galat: "Keperluan, guru yang ditugaskan, dan tanggal berangkat wajib diisi.", status: 400 };
    if (kembali < berangkat) return { galat: "Tanggal kembali lebih awal dari tanggal berangkat.", status: 400 };
    const guru = await prisma.teacher.findMany({ where: { id: { in: guruIds } }, select: { id: true, nip: true, user: { select: { name: true } } } });
    if (guru.length !== guruIds.length) return { galat: "Guru tidak ditemukan.", status: 404 };
    const tempat = (d: (typeof urut)[number]) => `${d.name}${d.address ? `, ${d.address}` : d.kecamatan ? `, ${d.kecamatan}` : ""}`.slice(0, 250);
    const teks = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const withSppd = b.withSppd === true;
    return {
      tanggal, namaMitra: urut.map(d => d.name).join("; "), klasifikasi: info.klasifikasi,
      perihal: `${KEPERLUAN_TUGAS[keperluan]}${withSppd ? " (+ SPPD)" : ""}`,
      isian: { jenis, tanggal: iso(tanggal), mitraIds, studentIds, guruIds, keperluan, berangkat: iso(berangkat), kembali: iso(kembali), jam: teks(b.jam, 60), transportasi: teks(b.transportasi, 80), sumberBiaya: teks(b.sumberBiaya, 40), withSppd },
      tugas: {
        data: {
          maksud: KEPERLUAN_TUGAS[keperluan], dasar: "Program Praktik Kerja Lapangan (PKL)",
          tempat: tempat(urut[0]), tempat2: urut[1] ? tempat(urut[1]) : null, tempat3: urut[2] ? tempat(urut[2]) : null,
          jam: teks(b.jam, 60) || null, tanggalBerangkat: berangkat, tanggalKembali: kembali,
          transportasi: teks(b.transportasi, 80) || null, sumberBiaya: teks(b.sumberBiaya, 40) || null,
          withSppd, withLaporan: withSppd, keterangan: `Dibuat dari Pusat PKL${studentIds.length ? ` · ${studentIds.length} siswa` : ""}`,
        },
        pegawai: guruIds.map((id, i) => { const g = guru.find(x => x.id === id)!; return { teacherId: g.id, nama: g.user.name, nip: g.nip, jabatan: "Guru Pembimbing PKL", peran: "PELAKSANA", urutan: i }; }),
      },
    };
  }

  // Permohonan / Pengantar / Penarikan — satu surat untuk SATU DUDI, memuat daftar siswanya.
  if (mitraIds.length !== 1) return { galat: "Surat ini untuk satu DUDI.", status: 400 };
  if (!studentIds.length) return { galat: "Pilih siswa yang dicantumkan di surat.", status: 400 };
  const mulai = tanggalDari(b.mulai), selesai = tanggalDari(b.selesai);
  if (!mulai || !selesai || selesai < mulai) return { galat: "Isi tanggal mulai dan selesai PKL dengan benar.", status: 400 };
  const [siswa, s] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { nis: true, gender: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } }, internship: { select: { teacher: { select: { user: { select: { name: true } } } } } } },
      orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }],
    }),
    getSettings(["school.name"]),
  ]);
  if (siswa.length !== studentIds.length) return { galat: "Ada siswa yang tidak ditemukan.", status: 404 };
  const d = urut[0];
  const guru = [...new Set(siswa.map(x => x.internship?.teacher?.user.name).filter((x): x is string => !!x))];
  const lamaBulan = Number.isInteger(b.lamaBulan) && (b.lamaBulan as number) > 0 ? (b.lamaBulan as number) : null;
  return {
    tanggal, namaMitra: d.name, klasifikasi: info.klasifikasi, perihal: info.perihal,
    isian: { jenis, tanggal: iso(tanggal), mitraIds, studentIds, mulai: iso(mulai), selesai: iso(selesai), lamaBulan },
    surat: {
      pihak: `${d.pimpinanJabatan || "Pimpinan"} ${d.name}${d.address ? `\ndi ${d.address}` : ""}`,
      keterangan: `Dibuat dari Pusat PKL · ${siswa.length} siswa`,
      content: isiSuratPkl(jenis, {
        sekolah: s["school.name"] || "SMK Al Munawwir IIBS", dudi: d.name, mulai: mulai.toISOString(), selesai: selesai.toISOString(), lamaBulan,
        guru: guru.length ? guru.join(" dan ") : null,
        siswa: siswa.map(x => ({ nama: x.user.name, nis: x.nis, kelas: x.class?.name ?? null, jurusan: x.major?.name ?? "", jk: x.gender })),
      }),
    },
  };
}

/** Isian untuk formulir Ubah. Surat lama tanpa `data` (dibuat sebelum kolom itu ada) diturunkan dari baris suratnya. */
export async function isianDariSurat(t: { jenis: string; data: unknown; mitraIds: string[]; studentIds: string[]; suratTugasId: string | null; createdAt: Date }): Promise<IsianSuratPkl> {
  if (t.data && typeof t.data === "object") return t.data as IsianSuratPkl;
  const dasar = { jenis: t.jenis as JenisSuratPkl, tanggal: iso(new Date(t.createdAt.getTime() + 7 * 3600_000)), mitraIds: t.mitraIds, studentIds: t.studentIds };
  if (t.suratTugasId) {
    const st = await prisma.suratTugas.findUnique({ where: { id: t.suratTugasId }, include: { pegawai: { orderBy: { urutan: "asc" } } } });
    if (st) return {
      ...dasar, tanggal: iso(st.tanggal), guruIds: st.pegawai.map(p => p.teacherId).filter((x): x is string => !!x),
      keperluan: Object.entries(KEPERLUAN_TUGAS).find(([, v]) => v === st.maksud)?.[0] ?? "MONITORING",
      berangkat: iso(st.tanggalBerangkat), kembali: iso(st.tanggalKembali), jam: st.jam ?? "", transportasi: st.transportasi ?? "", sumberBiaya: st.sumberBiaya ?? "", withSppd: st.withSppd,
    };
  }
  return dasar;
}
