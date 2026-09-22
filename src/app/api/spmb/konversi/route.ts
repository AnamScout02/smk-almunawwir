import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { BUKU_INDUK_FULL_JABATAN } from "@/lib/buku-induk-access";
import { cocokJurusan, dataSiswaDariPendaftar, emailDariNis, hashSandiBawaan, penghitungNis } from "@/lib/spmb-konversi";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

async function boleh() {
  const s = await verifySession();
  if (s.role === "ADMIN") return s;
  if (s.role === "TEACHER" || s.role === "TAS") {
    const j = await getJabatanNames(s.email);
    if (j.some(n => BUKU_INDUK_FULL_JABATAN.includes(n))) return s;
  }
  return null;
}

/** Pendaftar DITERIMA yang belum masuk Buku Induk + pilihan kelas X. Admin, staf TU, Operator Sekolah. */
export async function GET() {
  if (!(await boleh())) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
  const [pendaftar, jurusan, kelas, sudah] = await Promise.all([
    prisma.admission.findMany({ where: { status: "ACCEPTED", studentId: null }, orderBy: [{ chosenMajor: "asc" }, { fullName: "asc" }] }),
    prisma.major.findMany({ select: { id: true, code: true, name: true, nisCode: true } }),
    prisma.class.findMany({ where: { grade: 10 }, select: { id: true, name: true, majorId: true }, orderBy: { name: "asc" } }),
    prisma.admission.count({ where: { studentId: { not: null } } }),
  ]);
  return Response.json({
    sudahDikonversi: sudah,
    kelas,
    pendaftar: pendaftar.map(a => {
      const j = cocokJurusan(a.chosenMajor, jurusan);
      return {
        id: a.id, nama: a.fullName, jurusanPilihan: a.chosenMajor, majorId: j?.id ?? null, jurusanKode: j?.code ?? null,
        siapNis: !!j?.nisCode, nisn: a.nisn, sekolahAsal: a.previousSchool, daftarUlang: !!a.daftarUlangConfirmedAt, bayarTerverifikasi: a.paymentVerified,
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
    prisma.admission.findMany({ where: { id: { in: ids }, status: "ACCEPTED", studentId: null } }),
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
        if ((e as { code?: string }).code !== "P2002") { hasil.push({ nama: a.fullName, galat: "Gagal menyimpan" }); break; }
        // NIS/email bentrok → coba nomor berikutnya.
      }
    }
  }
  const jumlah = hasil.filter(h => h.nis).length;
  await logActivity(session, { action: "CREATE", entity: "Student", description: `Konversi ${jumlah} pendaftar SPMB ke Buku Induk` }).catch(() => null);
  return Response.json({ jumlah, hasil });
}
