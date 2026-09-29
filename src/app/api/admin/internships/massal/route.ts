import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertHumas } from "@/lib/humas-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { TEMPAT_BELUM_DITENTUKAN } from "@/lib/pkl-tempat";

export const dynamic = "force-dynamic";

/**
 * Memasukkan SELURUH siswa aktif satu tingkat sebagai peserta PKL sekaligus (permintaan user
 * 29 September 2026: "masukkan semua kelas 12 sebagai siswa pkl"). Penempatan boleh belum pasti —
 * `company` dibiarkan "Belum ditentukan" dan disunting per siswa saat tempatnya sudah tetap;
 * selama masih bernilai itu, siswa yang tingkatnya dibuka tetap boleh mengajukan pilihan tempat.
 *
 * Siswa yang SUDAH punya baris PKL tidak disentuh — jadi tombol ini aman ditekan berulang dan
 * tidak pernah menimpa penempatan yang sudah diisi.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const { grade, startDate, endDate, company, position } = await req.json() as {
      grade?: number; startDate?: string; endDate?: string; company?: string; position?: string;
    };

    if (!Number.isInteger(grade) || ![10, 11, 12].includes(grade as number)) {
      return NextResponse.json({ error: "Tingkat kelas tidak sah." }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Tanggal mulai dan selesai wajib diisi." }, { status: 400 });
    }
    const mulai = new Date(startDate);
    const selesai = new Date(endDate);
    if (Number.isNaN(+mulai) || Number.isNaN(+selesai) || selesai < mulai) {
      return NextResponse.json({ error: "Rentang tanggal tidak sah." }, { status: 400 });
    }

    const siswa = await prisma.student.findMany({
      where: {
        studentStatus: "AKTIF",
        class: { grade: grade as number },
        internship: null, // yang sudah punya data PKL dilewati, bukan ditimpa
      },
      select: { id: true },
    });
    if (siswa.length === 0) {
      return NextResponse.json({ dibuat: 0, pesan: "Semua siswa tingkat ini sudah terdaftar sebagai peserta PKL." });
    }

    await prisma.internship.createMany({
      data: siswa.map(s => ({
        studentId: s.id,
        company: company?.trim() || TEMPAT_BELUM_DITENTUKAN,
        position: position?.trim() || "—",
        supervisor: "—",
        startDate: mulai,
        endDate: selesai,
        status: "ONGOING",
      })),
    });

    await logActivity(session, {
      action: "CREATE", entity: "Internship",
      description: `Memasukkan ${siswa.length} siswa kelas ${grade} sebagai peserta PKL (${company?.trim() || TEMPAT_BELUM_DITENTUKAN})`,
    });
    return NextResponse.json({ dibuat: siswa.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    console.error("[internships massal]", e);
    return NextResponse.json({ error: "Gagal memasukkan peserta PKL." }, { status: 500 });
  }
}
