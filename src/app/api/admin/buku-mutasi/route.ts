import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const tahun = searchParams.get("tahun");
    const tipe  = searchParams.get("tipe");

    const yearFilter = tahun ? {
      gte: new Date(`${tahun}-01-01`),
      lte: new Date(`${tahun}-12-31T23:59:59`),
    } : undefined;

    const allStudents = await prisma.student.findMany({
      where: yearFilter
        ? {
            OR: [
              { user: { createdAt: yearFilter } },
              { exitDate: yearFilter },
            ],
          }
        : undefined,
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
        class: { select: { name: true, grade: true } },
        major: { select: { name: true, code: true } },
      },
      orderBy: { user: { createdAt: "asc" } },
    });

    const masuk = allStudents
      .filter(s => {
        const thn = tahun ? new Date(s.user.createdAt).getFullYear() === parseInt(tahun) : true;
        return thn;
      })
      .map(s => ({
        id: s.id,
        tipe: "MASUK" as const,
        tanggal: s.user.createdAt,
        nis: s.nis,
        nama: s.user.name,
        kelas: s.class?.name ?? "-",
        jurusan: s.major.code,
        asal: (s.bukuIndukData as Record<string, string> | null)?.pindahanDari ?? "Siswa Baru",
        keterangan: s.studentNotes ?? "",
      }));

    const keluar = allStudents
      .filter(s => {
        if (!["PINDAH", "KELUAR", "LULUS"].includes(s.studentStatus ?? "")) return false;
        if (tahun && s.exitDate) {
          return new Date(s.exitDate).getFullYear() === parseInt(tahun);
        }
        return !!s.exitDate || ["PINDAH", "KELUAR", "LULUS"].includes(s.studentStatus ?? "");
      })
      .map(s => ({
        id: s.id,
        tipe: s.studentStatus as string,
        tanggal: s.exitDate ?? s.user.createdAt,
        nis: s.nis,
        nama: s.user.name,
        kelas: s.class?.name ?? "-",
        jurusan: s.major.code,
        tujuan: (s.bukuIndukData as Record<string, string> | null)?.transferTo ?? "-",
        alasan: (s.bukuIndukData as Record<string, string> | null)?.alasanPindah ?? s.studentNotes ?? "-",
      }));

    if (tipe === "MASUK") return NextResponse.json({ masuk, keluar: [] });
    if (tipe === "KELUAR") return NextResponse.json({ masuk: [], keluar });
    return NextResponse.json({ masuk, keluar });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ masuk: [], keluar: [], error: "Gagal mengambil data mutasi" }, { status: 500 });
  }
}
