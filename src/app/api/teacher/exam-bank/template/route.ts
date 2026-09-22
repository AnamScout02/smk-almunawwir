import { verifyRole } from "@/lib/dal";
import { buatTemplateWord, buatTemplateExcel } from "@/lib/soal-template";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** `?jenis=word` (naskah soal .docx) atau `?jenis=excel` (pengaturan + kunci .xlsx).
 * Parameter opsional `mapel`, `kelas`, `guru`, `nama` untuk pra-isi. Keduanya berisi contoh terisi
 * nomor 1-9 untuk SEMUA jenis soal (tidak lagi puluhan baris kosong). */
export async function GET(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const sp = new URL(req.url).searchParams;
  const jenis = sp.get("jenis") === "excel" ? "excel" : "word";
  const mapel = sp.get("mapel") ?? undefined;

  if (jenis === "excel") {
    const buf = await buatTemplateExcel({ namaTest: sp.get("nama") ?? undefined, mapel });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template-pengaturan-ujian.xlsx"',
      },
    });
  }
  const buf = await buatTemplateWord({ mapel, kelas: sp.get("kelas") ?? undefined, guru: sp.get("guru") ?? (session.role === "TEACHER" ? session.name : undefined) });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="template-naskah-soal.docx"',
    },
  });
}
