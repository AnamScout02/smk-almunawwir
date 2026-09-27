import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { NextRequest } from "next/server";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { PANJANG_MAKS_PESAN } from "@/lib/pesan-ujian";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** PESAN KE SEMUA UJIAN SEKALIGUS — dari Ruang Kendali (superadmin/proktor), mis. "Waktu tersisa 10 menit" untuk
 * semua ujian yang sedang berlangsung. Satu baris PesanUjian (sasaran SEMUA) per ujian; tiap ujian diperiksa aksesnya. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const b = await req.json().catch(() => ({})) as { teks?: unknown; examIds?: unknown };
    const teks = String(b.teks ?? "").trim().slice(0, PANJANG_MAKS_PESAN);
    if (!teks) return Response.json({ error: "Tulis isi pesannya dulu." }, { status: 400 });
    const ids = Array.isArray(b.examIds) ? [...new Set(b.examIds.map(String))].slice(0, 100) : [];
    if (!ids.length) return Response.json({ error: "Tidak ada ujian yang dipilih." }, { status: 400 });
    let terkirim = 0;
    for (const id of ids) {
      const exam = await ujianDalamCakupan(session, id);
      if (!exam) continue;
      await prisma.pesanUjian.create({ data: { examId: id, teks, sasaran: "SEMUA", pengirimId: session.userId, pengirimNama: session.name } });
      kirimSinyal(id);
      terkirim++;
    }
    if (!terkirim) return Response.json({ error: "Tidak ada ujian yang boleh Anda kirimi pesan." }, { status: 403 });
    await logActivity(session, { action: "PESAN_PESERTA_UJIAN", entity: "Exam", entityId: ids[0], description: `Mengirim pesan ke ${terkirim} ujian: ${teks.slice(0, 80)}` }).catch(() => {});
    return Response.json({ ok: true, terkirim });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}
