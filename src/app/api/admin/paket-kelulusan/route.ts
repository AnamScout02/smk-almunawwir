import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { buatSuratSiswa } from "@/lib/surat-siswa";
import { muatPaketKelulusan } from "@/lib/paket-kelulusan";

export const dynamic = "force-dynamic";
const BATAS = 60;

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const q = req.nextUrl.searchParams;
    const [kelas, lulusan, baris] = await Promise.all([
      prisma.class.findMany({ where: { grade: 12 }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.student.findMany({ where: { studentStatus: "LULUS" }, select: { bukuIndukData: true } }),
      muatPaketKelulusan({ kelas: q.get("kelas") ?? undefined, lulus: q.get("lulus") ?? undefined }),
    ]);
    const tahun = [...new Set(lulusan.map(s => String(((s.bukuIndukData ?? {}) as Record<string, unknown>).graduationDate ?? "").slice(0, 4)).filter(t => /^\d{4}$/.test(t)))].sort().reverse();
    return Response.json({ kelas, tahun, baris });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat paket kelulusan." }, { status: 500 }); }
}

/** BUAT SKL MASSAL untuk siswa terpilih yang BELUM punya SKL. Dibuat berurutan (nomor surat berurutan menurut abjad),
 *  maksimal 60 sekali jalan. Yang sudah punya dilewati — aman ditekan ulang. */
export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const ids = [...new Set(Array.isArray(b.studentIds) ? b.studentIds.filter((x): x is string => typeof x === "string") : [])];
    const tgl = typeof b.tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.tanggal) ? new Date(`${b.tanggal}T00:00:00Z`) : null;
    const nomorSk = typeof b.nomorSk === "string" ? b.nomorSk.trim().slice(0, 100) : "";
    const tglSk = typeof b.tanggalSk === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.tanggalSk) ? new Date(`${b.tanggalSk}T00:00:00Z`) : null;
    if (!ids.length) return Response.json({ error: "Pilih siswanya." }, { status: 400 });
    if (ids.length > BATAS) return Response.json({ error: `Maksimal ${BATAS} siswa sekali jalan. Kerjakan per kelas.` }, { status: 400 });
    if (!tgl) return Response.json({ error: "Isi tanggal surat." }, { status: 400 });
    if (nomorSk.length < 3 || !tglSk) return Response.json({ error: "Isi nomor dan tanggal SK kelulusan (dasar surat keterangan lulus)." }, { status: 400 });
    const siswa = await prisma.student.findMany({ where: { id: { in: ids }, studentStatus: { in: ["AKTIF", "LULUS"] } }, select: { id: true, bukuIndukData: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
    const adaSurat = new Set((await prisma.surat.findMany({ where: { id: { in: siswa.map(s => String(((s.bukuIndukData ?? {}) as Record<string, unknown>).sklSuratId ?? "")).filter(Boolean) } }, select: { id: true } })).map(x => x.id));
    const tglSkTeks = tglSk.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    let dibuat = 0, dilewati = 0; const gagal: string[] = [];
    for (const s of siswa) {
      const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
      if (typeof d.sklSuratId === "string" && adaSurat.has(d.sklSuratId)) { dilewati++; continue; }
      try {
        const surat = await buatSuratSiswa({ template: "KET_LULUS", studentId: s.id, tanggal: tgl, isi: { "NOMOR SK": nomorSk, "TANGGAL SK": tglSkTeks } });
        await prisma.student.update({ where: { id: s.id }, data: { bukuIndukData: { ...d, sklSuratId: surat.id, sklNomor: surat.nomor } } });
        dibuat++;
      } catch { gagal.push(s.user.name); }
    }
    await logActivity(session, { action: "CREATE", entity: "Surat", description: `SKL massal: ${dibuat} dibuat, ${dilewati} sudah ada${gagal.length ? `, ${gagal.length} gagal` : ""}` }).catch(() => null);
    return Response.json({ ok: true, dibuat, dilewati, gagal });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal membuat SKL." }, { status: 500 }); }
}
