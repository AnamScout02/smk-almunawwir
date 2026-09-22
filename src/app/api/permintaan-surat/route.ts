import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { siswaYangBolehDiajukan } from "@/lib/permintaan-surat";
import { JENIS_SURAT } from "@/lib/tu-konstanta";

export const dynamic = "force-dynamic";

const JENIS_LEGALISIR = ["IJAZAH", "SKHUN", "RAPOR", "SKL", "LAINNYA"];

/** Daftar permintaan milik pemakai yang login — siswa melihat miliknya sendiri, orang tua
 * melihat permintaan untuk semua anaknya. */
export async function GET() {
  try {
    const session = await verifyRole(["STUDENT", "PARENT"]);
    const siswa = await siswaYangBolehDiajukan(session);
    const ids = siswa.map(s => s.id);
    if (ids.length === 0) return Response.json({ siswa: [], surat: [], legalisir: [] });

    const [surat, legalisir] = await Promise.all([
      prisma.suratKeterangan.findMany({
        where: { studentId: { in: ids }, requestStatus: { not: null } },
        orderBy: { createdAt: "desc" }, take: 50,
        select: {
          id: true, jenis: true, keperluan: true, tujuan: true, nomorSurat: true, tanggal: true,
          requestStatus: true, requestedAt: true, rejectReason: true, namaSiswa: true, studentId: true,
        },
      }),
      prisma.legalisirRequest.findMany({
        where: { studentId: { in: ids }, requestStatus: { not: null } },
        orderBy: { createdAt: "desc" }, take: 50,
        select: {
          id: true, documentType: true, copies: true, purpose: true, status: true, requestDate: true,
          requestStatus: true, requestedAt: true, rejectReason: true, pickupDate: true,
          applicantName: true, studentId: true,
        },
      }),
    ]);
    return Response.json({ siswa, surat, legalisir });
  } catch {
    return Response.json({ error: "Gagal memuat permintaan surat" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT", "PARENT"]);
    const b = await req.json();
    const siswa = await siswaYangBolehDiajukan(session);

    // studentId dari klien hanya dipakai untuk MEMILIH di antara siswa yang memang berhak —
    // kalau tidak cocok, permintaan ditolak (bukan diam-diam dialihkan ke siswa lain).
    const target = b.studentId ? siswa.find(s => s.id === b.studentId) : siswa[0];
    if (!target) return Response.json({ error: "Siswa tidak ditemukan atau bukan tanggungan akun ini." }, { status: 403 });
    if (!b.keperluan?.trim()) return Response.json({ error: "Keperluan wajib diisi." }, { status: 400 });

    if (b.tipe === "LEGALISIR") {
      if (!JENIS_LEGALISIR.includes(b.documentType)) return Response.json({ error: "Jenis dokumen tidak dikenal." }, { status: 400 });
      const row = await prisma.legalisirRequest.create({
        data: {
          requestDate: new Date(),
          studentId: target.id,
          applicantName: target.nama,
          documentType: b.documentType,
          copies: Number(b.copies) > 0 ? Math.min(Number(b.copies), 20) : 1,
          purpose: b.keperluan.trim(),
          status: "DIPROSES",
          requestStatus: "DIAJUKAN",
          requestedById: session.userId,
          requestedAt: new Date(),
        },
      });
      return Response.json(row, { status: 201 });
    }

    const jenis = String(b.jenis || "AKTIF");
    if (!JENIS_SURAT.some(j => j.value === jenis)) return Response.json({ error: "Jenis surat tidak dikenal." }, { status: 400 });

    const row = await prisma.suratKeterangan.create({
      data: {
        // Nomor surat sengaja BELUM diterbitkan di sini — baru dibuat kalau TU menyetujui,
        // supaya nomor resmi sekolah tidak habis terpakai oleh permintaan yang batal/ditolak.
        nomorSurat: null,
        jenis, tanggal: new Date(),
        studentId: target.id,
        namaSiswa: target.nama,
        nisSiswa: target.nis,
        kelasSiswa: target.kelas,
        keperluan: b.keperluan.trim(),
        tujuan: b.tujuan?.trim() || null,
        requestStatus: "DIAJUKAN",
        requestedById: session.userId,
        requestedAt: new Date(),
      },
    });
    return Response.json(row, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal mengirim permintaan." }, { status: 500 });
  }
}
