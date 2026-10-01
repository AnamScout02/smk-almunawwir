import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar pilihan baku (agama, pendidikan, pekerjaan, …) untuk formulir "Biodata Saya" pegawai.
 *  Sama isinya dengan master-data siswa; yang beda hanya perannya. */
export async function GET() {
  try {
    await verifyRole(["TEACHER", "TAS", "ADMIN"]);
    const data = await prisma.masterData.findMany({ orderBy: { category: "asc" } });
    return NextResponse.json(data);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal memuat data pilihan" }, { status: 500 });
  }
}
