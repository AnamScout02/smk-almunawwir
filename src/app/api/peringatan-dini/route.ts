import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { hitungRisikoSiswa } from "@/lib/peringatan-dini";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** PERINGATAN DINI SISWA BERISIKO (src/lib/peringatan-dini.ts).
 *   ADMIN, Guru BK, Wakil Kepala Kesiswaan → seluruh siswa aktif.
 *   Wali kelas lain                         → hanya kelas yang ia walikan.
 * Data pribadi pembinaan: guru mapel yang bukan wali/BK/Kesiswaan tidak mendapat akses. */
export async function GET() {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole(["ADMIN", "TEACHER"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let classIds: string[] | undefined;
  let cakupan = "Seluruh sekolah";
  if (session.role === "TEACHER") {
    const jabatan = await getJabatanNames(session.email);
    // Kepala Sekolah ikut melihat seluruh sekolah (dashboard eksekutif, 17 Sep 2026).
    if (!jabatan.some(j => KESISWAAN_BK_JABATAN.includes(j) || j === "Kepala Sekolah")) {
      const guru = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        select: { homeroomOf: { select: { id: true, name: true } } },
      });
      const kelas = guru?.homeroomOf ?? [];
      if (!kelas.length) return Response.json({ error: "Khusus wali kelas, Guru BK, dan Wakil Kepala Kesiswaan." }, { status: 403 });
      classIds = kelas.map(k => k.id);
      cakupan = `Kelas wali: ${kelas.map(k => k.name).join(", ")}`;
    }
  }

  const hasil = await hitungRisikoSiswa({ classIds });
  return Response.json({ ...hasil, cakupanAkses: cakupan });
}
