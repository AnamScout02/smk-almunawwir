import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

/** Bel Sekolah Otomatis — jadwal dikelola staf TU (Tenaga Administrasi Sekolah), sama pola akses
 * dgn modul TU lain (Buku Mutasi, Persuratan, dst). GET dibuka lebih luas (ADMIN/TAS/TEACHER) krn
 * halaman Player perlu dibaca siapa pun yg buka (mis. Guru Piket kalau TU berhalangan) — TAPI
 * create/edit/hapus jadwal TETAP khusus TU lewat verifyTasAccess di POST/PUT/DELETE. */
export async function GET() {
  try {
    const schedules = await prisma.bellSchedule.findMany({ orderBy: [{ time: "asc" }, { order: "asc" }] });
    return Response.json(schedules);
  } catch {
    return Response.json({ error: "Gagal memuat jadwal bel" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { label, time, days, audioUrl } = body as { label: string; time: string; days: string[]; audioUrl?: string };
    if (!label?.trim() || !time || !Array.isArray(days) || days.length === 0) {
      return Response.json({ error: "Nama, waktu, dan minimal 1 hari wajib diisi." }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) return Response.json({ error: "Format waktu tidak valid (HH:mm)." }, { status: 400 });

    const created = await prisma.bellSchedule.create({
      data: { label: label.trim(), time, days: days.join(","), audioUrl: audioUrl?.trim() || null },
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus staf Tata Usaha." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan jadwal bel" }, { status: 500 });
  }
}
