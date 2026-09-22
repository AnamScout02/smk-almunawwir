import { verifyRole } from "@/lib/dal";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { aksesForm, muatForm, usulanIsian } from "@/lib/rapor-form-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** USULAN ISIAN form nilai rapor dari data yang sudah ada — materi & nilai Jurnal Mengajar, nilai CBT STS/SAS
 * (src/lib/rapor-form-server.ts `usulanIsian`). Tidak menyimpan apa pun: layar guru yang memutuskan memakainya. */
export async function GET(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classId") ?? "", subject = sp.get("subject") ?? "", semester = sp.get("semester") ?? "";
  if (!semesterRapor().includes(semester)) return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
  const akses = await aksesForm(session, classId, subject);
  if (!akses?.bolehUbah) return Response.json({ error: "Anda tidak berhak." }, { status: 403 });
  const f = await muatForm(classId, subject, semester);
  if (!f) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  return Response.json(await usulanIsian(classId, subject, semester, f.pengaturan.kkm));
}
