import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: {
        major: { select: { skills: true } },
        internship: {
          // Hanya yang memang untuk siswa — dulu seluruh baris ikut terkirim (termasuk hash tautan penilaian industri).
          select: {
            id: true, company: true, position: true, supervisor: true, startDate: true, endDate: true, status: true, lamaBulan: true,
            teacher: { select: { user: { select: { name: true } } } },
            mitra: { select: { address: true, kecamatan: true, jamKerja: true, contactPhone: true } },
            journal: { orderBy: { date: "desc" }, select: { id: true, date: true, activity: true, photoUrl: true, teacherNote: true, fotoTerverifikasi: true, fotoWaktu: true, kompetensi: true, lat: true, parafIndustriAt: true, parafIndustriNama: true } },
            laporanMasalah: { orderBy: { createdAt: "desc" }, where: { pelapor: "SISWA" }, select: { id: true, jenis: true, isi: true, status: true, tindakLanjut: true, createdAt: true, selesaiPada: true } },
          },
        },
      },
    });
    return Response.json({ internship: student?.internship ?? null, kompetensi: student?.major?.skills ?? [] });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat data PKL" }, { status: 500 });
  }
}
