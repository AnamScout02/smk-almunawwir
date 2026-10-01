import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { rapikanSasaran } from "@/lib/pengumuman";
import { hakKegiatan, isoWib, tengahMalamWib } from "@/lib/kegiatan-qr";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const JENIS = ["RAPAT", "KEGIATAN", "UPACARA", "PELATIHAN"];

/** Daftar kegiatan yang dikelola (pimpinan/TU: semua; lainnya: buatan sendiri) + pilihan sasaran. */
export async function GET() {
  const session = await verifySession();
  const hak = await hakKegiatan(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  // Daftar ORANG yang boleh dipilih satu per satu. Lingkupnya mengikuti hak: guru biasa hanya melihat
  // pegawai (ia memang hanya boleh menyasar guru & staf), wali kelas ditambah siswa kelas walinya,
  // pemegang hak pengumuman melihat seluruh siswa aktif. Daftar siswa TIDAK dikirim ke guru yang
  // tidak berhak menyasarnya.
  const idKelasWali = hak.waliKelas.map(k => k.id);
  const [daftar, kelas, jurusan, jabatan, siswa, pegawai] = await Promise.all([
    prisma.kegiatan.findMany({ where: hak.semua ? {} : { pembuatId: session.userId }, orderBy: { mulai: "desc" }, take: 200, include: { _count: { select: { presensi: true } } } }),
    hak.semua ? prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }) : Promise.resolve(hak.waliKelas),
    hak.semua ? prisma.major.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.jabatan.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    hak.semua || idKelasWali.length
      ? prisma.student.findMany({
          where: { studentStatus: "AKTIF", ...(hak.semua ? {} : { classId: { in: idKelasWali } }) },
          select: { userId: true, user: { select: { name: true } }, class: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.user.findMany({ where: { role: { in: ["TEACHER", "TAS"] } }, select: { id: true, name: true, role: true } }),
  ]);
  return Response.json({
    semua: hak.semua, wali: hak.waliKelas.length > 0,
    kelas, jurusan: jurusan.map(j => ({ id: j.id, name: `${j.code} — ${j.name}` })), jabatan: jabatan.map(j => j.name),
    orang: [
      ...pegawai.map(u => ({ id: u.id, nama: u.name, ket: u.role === "TAS" ? "Staf" : "Guru" }))
        .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
      ...siswa.map(x => ({ id: x.userId, nama: x.user.name, ket: x.class?.name ?? "Tanpa kelas" }))
        .sort((a, b) => a.ket.localeCompare(b.ket, "id", { numeric: true }) || a.nama.localeCompare(b.nama, "id")),
    ],
    daftar: daftar.map(({ _count, ...k }) => ({ ...k, jumlahHadir: _count.presensi, milikSaya: k.pembuatId === session.userId })),
    bolehMemutus: hak.semua,
  });
}

export async function POST(req: Request) {
  const session = await verifySession();
  const hak = await hakKegiatan(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const mulai = new Date(b.mulai), selesai = new Date(b.selesai);
  if (!judul) return Response.json({ error: "Nama kegiatan wajib diisi." }, { status: 400 });
  if (isNaN(mulai.getTime()) || isNaN(selesai.getTime()) || selesai <= mulai) return Response.json({ error: "Waktu mulai/selesai tidak valid." }, { status: 400 });
  // Kegiatan berhari-hari (mis. MPLS): jam hariannya sama, yang disimpan hanya TANGGAL terakhirnya.
  // Kosong / sama dengan hari mulai = kegiatan satu hari (sampaiTanggal tetap null).
  const sampaiIso = String(b.sampaiTanggal ?? "").trim();
  let sampaiTanggal: Date | null = null;
  if (sampaiIso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sampaiIso)) return Response.json({ error: "Tanggal selesai tidak valid." }, { status: 400 });
    const awalIso = isoWib(mulai);
    if (sampaiIso < awalIso) return Response.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }, { status: 400 });
    if (sampaiIso > awalIso) {
      const hari = Math.round((tengahMalamWib(sampaiIso).getTime() - tengahMalamWib(awalIso).getTime()) / 86_400_000) + 1;
      if (hari > 60) return Response.json({ error: "Kegiatan paling lama 60 hari." }, { status: 400 });
      sampaiTanggal = tengahMalamWib(sampaiIso);
    }
  }
  // Guru tanpa hak pengumuman: sasaran hanya guru & staf.
  const hakSasaran = hak.semua || hak.waliKelas.length ? hak : { ...hak, semua: true };
  const r = rapikanSasaran(hak.semua || hak.waliKelas.length ? b : { ...b, targetRole: "TEACHER" }, hakSasaran);
  if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });
  if (!hak.semua && !hak.waliKelas.length && !r.orang.length && r.sasaran.targetRole !== "TEACHER") return Response.json({ error: "Sasaran hanya guru & staf." }, { status: 403 });
  // Daftar orang dari browser TIDAK dipercaya: guru biasa hanya boleh memilih pegawai, wali kelas
  // ditambah siswa kelas walinya. Tanpa ini, siapa pun yang bisa membuat kegiatan bisa menyasar
  // siswa mana pun di sekolah.
  let targetUserIds = r.orang;
  if (targetUserIds.length && !hak.semua) {
    const idKelasWali = hak.waliKelas.map(k => k.id);
    const boleh = await prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        OR: [
          { role: { in: ["TEACHER", "TAS"] } },
          ...(idKelasWali.length ? [{ student: { classId: { in: idKelasWali }, studentStatus: "AKTIF" } }] : []),
        ],
      },
      select: { id: true },
    });
    targetUserIds = boleh.map(x => x.id);
    if (!targetUserIds.length) return Response.json({ error: "Peserta yang dipilih di luar wewenang Anda." }, { status: 403 });
  }
  // PERSETUJUAN (18 Sep 2026): kegiatan yang dibuat pimpinan/TU langsung berlaku; usulan dari guru
  // biasa/wali kelas menunggu keputusan pemegang hak pengumuman supaya kegiatan sekolah tidak
  // bertabrakan tanpa sepengetahuan pimpinan.
  const k = await prisma.kegiatan.create({
    data: {
      judul, jenis: JENIS.includes(b.jenis) ? b.jenis : "KEGIATAN", tempat: String(b.tempat ?? "").trim().slice(0, 150) || null,
      mulai, selesai, sampaiTanggal, targetUserIds, catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null, ...r.sasaran,
      pembuatId: session.userId, pembuatNama: session.name,
      statusPersetujuan: hak.semua ? "DISETUJUI" : "DIAJUKAN",
    },
  });
  if (!hak.semua) {
    kirimLatar(async () => {
      const pemutus = await prisma.teacherJabatan.findMany({
        where: { jabatan: { name: { in: ["Kepala Sekolah", "Wakil Kepala Kesiswaan", "Wakil Kepala Kurikulum"] } } },
        select: { teacher: { select: { userId: true } } },
      }).catch(() => []);
      const userIds = [...new Set(pemutus.map(x => x.teacher.userId))];
      if (userIds.length) {
        await kirimNotifikasi({
          userIds, kunci: `kegiatan-diajukan:${k.id}`, jenis: "KEGIATAN",
          judul: `Usulan kegiatan: ${judul}`, isi: `Diajukan ${session.name} — menunggu persetujuan`,
          url: "/dashboard/teacher/kegiatan",
        });
      }
    });
  }
  return Response.json({ id: k.id }, { status: 201 });
}
