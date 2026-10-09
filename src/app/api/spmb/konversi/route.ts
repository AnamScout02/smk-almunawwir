import { prisma } from "@/lib/prisma";
import { cocokJurusan, dataSiswaDariPendaftar, emailDariNis, hashSandiBawaan, penghitungNis, sesiKonversi } from "@/lib/spmb-konversi";
import { logActivity } from "@/lib/activity-log";
import { aturanTahapan, denganBayar, ringkasBayar, setelanBayar } from "@/lib/spmb-tahapan-server";
import { hitungBayar, susunTahapan } from "@/lib/spmb-tahapan";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const boleh = sesiKonversi;

/** Pendaftar DITERIMA yang belum masuk Buku Induk + pilihan kelas X. Admin, staf TU, Operator Sekolah. */
export async function GET() {
  if (!(await boleh())) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
  const [pendaftar, jurusan, kelas, sudah] = await Promise.all([
    prisma.admission.findMany({ where: { status: { in: ["DITERIMA", "ACCEPTED"] }, studentId: null }, orderBy: [{ chosenMajor: "asc" }, { fullName: "asc" }] }),
    prisma.major.findMany({ select: { id: true, code: true, name: true, nisCode: true } }),
    // `isi` = siswa AKTIF di kelas itu sekarang — kelas tidak terikat tahun ajaran, jadi sebelum Kenaikan Kelas
    // "X TKJ 1" masih berisi angkatan berjalan dan calon baru akan bercampur (peringatan di layar konfirmasi).
    prisma.class.findMany({ where: { grade: 10 }, select: { id: true, name: true, majorId: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } }, orderBy: { name: "asc" } }),
    prisma.admission.count({ where: { studentId: { not: null } } }),
  ]);
  const [setBayar, petaBayar, aturan] = await Promise.all([setelanBayar(), ringkasBayar(pendaftar.map(a => a.id)), aturanTahapan()]);
  return Response.json({
    sudahDikonversi: sudah,
    kelas: kelas.map(({ _count, ...k }) => ({ ...k, isi: _count.students })),
    pendaftar: pendaftar.map(a => {
      const j = cocokJurusan(a.chosenMajor, jurusan);
      return {
        id: a.id, nama: a.fullName, jurusanPilihan: a.chosenMajor, majorId: j?.id ?? null, jurusanKode: j?.code ?? null,
        siapNis: !!j?.nisCode, nisn: a.nisn, tuntas: susunTahapan(denganBayar(a, setBayar, petaBayar), aturan).tuntas, sekolahAsal: a.previousSchool, daftarUlang: !!a.daftarUlangConfirmedAt, bayarTerverifikasi: hitungBayar(setBayar, a.potonganBiaya, petaBayar.get(a.id)?.sah ?? 0, 0, a.gelombangId).lunas || a.paymentVerified,
      };
    }),
  });
}

/** Buat akun & data Buku Induk untuk pendaftar terpilih: {ids, kelasPerJurusan: {majorId: classId}, enrollYear, tanggalDiterima}. */
export async function POST(req: Request) {
  const session = await boleh();
  if (!session) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 500) : [];
  const tahun = Math.round(Number(b.enrollYear)) || new Date().getFullYear();
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(b.tanggalDiterima)) ? String(b.tanggalDiterima) : `${tahun}-07-01`;
  const kelasPer = (b.kelasPerJurusan ?? {}) as Record<string, string>;
  if (!ids.length) return Response.json({ error: "Pilih pendaftar." }, { status: 400 });
  const [pendaftar, jurusan, kelas] = await Promise.all([
    // Diproses per jurusan lalu NAMA (7 Okt 2026): NIS terbit urut abjad di tiap jurusan, sama dengan urutan absen.
    prisma.admission.findMany({ where: { id: { in: ids }, status: { in: ["DITERIMA", "ACCEPTED"] }, studentId: null }, orderBy: [{ chosenMajor: "asc" }, { fullName: "asc" }] }),
    prisma.major.findMany({ select: { id: true, code: true, name: true, nisCode: true } }),
    prisma.class.findMany({ where: { grade: 10 }, select: { id: true, name: true, majorId: true } }),
  ]);
  const nis = await penghitungNis();
  const sandi = await hashSandiBawaan();
  const hasil: { nama: string; nis?: string; email?: string; galat?: string }[] = [];
  for (const a of pendaftar) {
    const j = cocokJurusan(a.chosenMajor, jurusan);
    if (!j) { hasil.push({ nama: a.fullName, galat: `Jurusan "${a.chosenMajor}" tidak dikenali` }); continue; }
    if (!j.nisCode) { hasil.push({ nama: a.fullName, galat: `Jurusan ${j.code} belum punya Kode Jurusan (NIS)` }); continue; }
    const k = kelas.find(x => x.id === kelasPer[j.id] && x.majorId === j.id) ?? null;
    const d = dataSiswaDariPendaftar(a, tanggal, k?.name);
    let berhasil = false;
    for (let coba = 0; coba < 5 && !berhasil; coba++) {
      const nomor = nis.berikutnya(j.id, j.nisCode);
      const email = emailDariNis(nomor);
      try {
        await prisma.$transaction(async tx => {
          const u = await tx.user.create({ data: { name: d.nama, email, password: sandi, role: "STUDENT" } });
          const s = await tx.student.create({ data: { userId: u.id, nis: nomor, majorId: j.id, classId: k?.id ?? null, enrollYear: tahun, studentStatus: "AKTIF", ...d.siswa } });
          await tx.admission.update({ where: { id: a.id }, data: { studentId: s.id, dikonversiPada: new Date(), dikonversiOleh: session.name } });
        });
        hasil.push({ nama: d.nama, nis: nomor, email });
        berhasil = true;
      } catch (e) {
        lemparBilaPengalihan(e);
        if ((e as { code?: string }).code !== "P2002") { hasil.push({ nama: a.fullName, galat: "Gagal menyimpan" }); break; }
        // NIS/email bentrok → coba nomor berikutnya.
      }
    }
  }
  const jumlah = hasil.filter(h => h.nis).length;
  await logActivity(session, { action: "CREATE", entity: "Student", description: `Konversi ${jumlah} pendaftar SPMB ke Buku Induk` }).catch(() => null);
  return Response.json({ jumlah, hasil });
}
