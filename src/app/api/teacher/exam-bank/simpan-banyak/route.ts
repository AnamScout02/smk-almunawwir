import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { resolveTeacherId } from "@/lib/teacher-context";
import { siapkanButir, type ButirMasuk } from "@/lib/soal-butir-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Simpan banyak butir sekaligus (hasil pratinjau impor yang sudah diperiksa guru). Butir yang
 * cacat DILEWATI dan dilaporkan, bukan menggagalkan seluruh kiriman - supaya 38 soal yang benar
 * tidak ikut hilang gara-gara 2 yang belum lengkap. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const body = await req.json();
    const subject = String(body.subject ?? "").trim();
    const butir = (Array.isArray(body.butir) ? body.butir : []) as (ButirMasuk & { nomor?: number })[];
    if (!subject) return Response.json({ error: "Mata pelajaran wajib diisi." }, { status: 400 });
    if (!butir.length) return Response.json({ error: "Tidak ada soal yang dikirim." }, { status: 400 });

    const teacherId = await resolveTeacherId(session, { subject });
    if (!teacherId) return Response.json({ error: "Tidak ditemukan guru pengampu mapel ini." }, { status: 400 });

    const dilewati: { nomor: number | undefined; alasan: string }[] = [];
    const siap = [];
    for (const b of butir) {
      const { data, error } = siapkanButir(b);
      if (error) { dilewati.push({ nomor: b.nomor, alasan: error }); continue; }
      siap.push(data);
    }
    if (siap.length) {
      await prisma.questionBankItem.createMany({
        data: siap.map(d => ({
          teacherId, subject, tipe: d.tipe, pertanyaan: d.pertanyaan, opsi: d.opsi as object,
          kunci: (d.kunci ?? undefined) as object | undefined, skor: d.skor ?? 1,
          kd: d.kd ?? null, pembahasan: d.pembahasan ?? null, stimulusId: d.stimulusId ?? null,
          materi: d.materi ?? null, indikator: d.indikator ?? null, levelKognitif: d.levelKognitif ?? null,
        })),
      });
    }
    return Response.json({ masuk: siap.length, dilewati });
  } catch {
    return Response.json({ error: "Gagal menyimpan soal." }, { status: 500 });
  }
}
