import { verifyRole } from "@/lib/dal";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { jadwalHariGuru, simpanJurnalCepat, wibIso } from "@/lib/jurnal-cepat";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";
const sah = (t: unknown): t is string => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t);

/** Jadwal guru hari ini + saran materi (src/lib/jurnal-cepat.ts). Guru hanya pernah melihat jadwalnya sendiri. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER"]);
    const teacherId = await teacherIdDariSesi(session);
    if (!teacherId) return Response.json({ tanggal: wibIso(), libur: null, kartu: [] });
    const t = new URL(req.url).searchParams.get("tanggal");
    return Response.json(await jadwalHariGuru(teacherId, sah(t) ? t : wibIso()));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat jadwal." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER"]);
    const teacherId = await teacherIdDariSesi(session);
    if (!teacherId) return Response.json({ error: "Akun ini tidak terhubung ke data guru." }, { status: 403 });
    const b = await req.json().catch(() => ({})) as { scheduleId?: string; tanggal?: string; materi?: string; semuaHadir?: boolean };
    const h = await simpanJurnalCepat({ teacherId, scheduleId: String(b.scheduleId ?? ""), tanggal: sah(b.tanggal) ? b.tanggal : undefined, materi: String(b.materi ?? ""), semuaHadir: b.semuaHadir === true });
    if (!h.ok) return Response.json({ error: h.pesan }, { status: h.kode });
    return Response.json(h, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan jurnal." }, { status: 500 });
  }
}
