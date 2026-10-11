import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/pkl-humas";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { getSettings } from "@/lib/site-settings";
import { hariWibIso, MAKS_FOTO, rentangHari, simpanAbsenEkstra } from "@/lib/ekstra-server";
import { pendaftarMenunggu, putuskanPendaftaran } from "@/lib/ekstra-siswa";
import { kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** PORTAL PEMBINA EKSTRAKURIKULER (10 Okt 2026) — satu tautan rahasia per ekskul, tanpa akun, untuk pembina dari luar
 *  sekolah: absensi anggota HARI INI, catatan kegiatan, dan foto bukti. Yang terlihat hanya nama & kelas anggota ekskul
 *  itu (tanpa NIS, alamat, kontak). Hari lampau tidak bisa diubah dari sini — itu wewenang koordinator. */
async function ekskulDari(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.extracurricular.findFirst({ where: { tokenPortalHash: hashToken(token) }, select: { id: true, name: true, jenis: true, jadwalRutin: true, tokenPortalDipakai: true } });
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`portal-ekstra-get:${getClientIpFromHeaders(req.headers)}`, 120, 600_000)) return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  const e = await ekskulDari((await params).token);
  if (!e) return Response.json({ error: "Tautan tidak berlaku. Minta tautan baru ke Koordinator Ekstrakurikuler sekolah." }, { status: 404 });
  const hariIni = hariWibIso(), { awal, akhir } = rentangHari(hariIni);
  // Jejak pemakaian tautan — paling sering sejam sekali supaya membuka portal tidak menulis ke database tiap kali.
  if (!e.tokenPortalDipakai || Date.now() - e.tokenPortalDipakai.getTime() > 3600_000) await prisma.extracurricular.update({ where: { id: e.id }, data: { tokenPortalDipakai: new Date() } }).catch(() => null);
  const pendaftar = await pendaftarMenunggu([e.id]);
  const [anggota, jurnal, riwayat, s] = await Promise.all([
    prisma.extracurricularMember.findMany({ where: { extracurricularId: e.id, student: { studentStatus: "AKTIF" } }, orderBy: { student: { user: { name: "asc" } } }, select: { studentId: true, role: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } } }),
    prisma.extracurricularJournal.findFirst({ where: { extracurricularId: e.id, date: { gte: awal, lt: akhir } }, select: { materi: true, foto: true, recordedByName: true, entries: { select: { studentId: true, status: true } } } }),
    prisma.extracurricularJournal.findMany({ where: { extracurricularId: e.id, date: { lt: awal } }, orderBy: { date: "desc" }, take: 6, select: { date: true, materi: true, foto: true, entries: { select: { status: true } } } }),
    getSettings(["school.name"]),
  ]);
  const status = new Map((jurnal?.entries ?? []).map(x => [x.studentId, x.status]));
  return Response.json({
    ekskul: e.name, jenis: e.jenis, jadwalRutin: e.jadwalRutin, sekolah: s["school.name"] || "SMK Al-Munawwir IIBS", hariIni, maksFoto: MAKS_FOTO,
    materi: jurnal?.materi ?? "", foto: jurnal?.foto ?? [], oleh: jurnal?.recordedByName ?? "",
    // "" (bukan "HADIR") bila belum dicatat — status tidak boleh punya nilai bawaan (CLAUDE.md #10).
    anggota: anggota.map(a => ({ id: a.studentId, nama: a.student.user.name, kelas: a.student.class?.name ?? "", peran: a.role ?? "", status: status.get(a.studentId) ?? "" })),
    // Siswa yang mendaftar ke ekskul ini dan menunggu keputusan pembina — nama & kelas saja.
    pendaftar: pendaftar.map(p => ({ id: p.id, nama: p.nama, kelas: p.kelas, alasan: p.alasan })),
    riwayat: riwayat.map(r => ({ tanggal: r.date.toISOString().slice(0, 10), materi: r.materi, foto: r.foto.length, hadir: r.entries.filter(x => x.status === "HADIR").length, peserta: r.entries.length })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`portal-ekstra-post:${getClientIpFromHeaders(req.headers)}`, 40, 600_000)) return Response.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
  const e = await ekskulDari((await params).token);
  if (!e) return Response.json({ error: "Tautan tidak berlaku." }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { nama?: unknown; materi?: unknown; rows?: unknown; putuskan?: { ids?: unknown; terima?: unknown } };
  const nama = typeof b.nama === "string" ? b.nama.trim().slice(0, 120) : "";
  if (nama.length < 3) return Response.json({ error: "Tulis nama Anda dulu (minimal 3 huruf)." }, { status: 400 });
  // Menerima/menolak pendaftar — dibatasi ke ekskul pemilik tautan lewat `ekskulIds`.
  if (b.putuskan) {
    const ids = (Array.isArray(b.putuskan.ids) ? b.putuskan.ids : []).map(String).filter(Boolean).slice(0, 200);
    if (!ids.length) return Response.json({ error: "Tidak ada pendaftar yang dipilih." }, { status: 400 });
    const h = await putuskanPendaftaran({ ids, terima: b.putuskan.terima === true, catatan: null, oleh: `${nama} (pembina, tautan)`, ekskulIds: [e.id], kirim: kirimNotifikasi });
    return Response.json({ ok: true, ...h });
  }
  const materi = typeof b.materi === "string" ? b.materi.trim().slice(0, 1000) : "";
  if (!materi) return Response.json({ error: "Tulis kegiatan/materi latihan hari ini." }, { status: 400 });
  const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 600).map(r => ({ studentId: String((r as Record<string, unknown>)?.studentId ?? ""), status: String((r as Record<string, unknown>)?.status ?? "") }));
  const jumlahAnggota = await prisma.extracurricularMember.count({ where: { extracurricularId: e.id, student: { studentStatus: "AKTIF" } } });
  if (!jumlahAnggota) return Response.json({ error: "Ekstrakurikuler ini belum punya anggota — hubungi koordinator." }, { status: 400 });
  const terisi = rows.filter(r => ["HADIR", "IZIN", "SAKIT", "ALPHA"].includes(r.status)).length;
  if (terisi < jumlahAnggota) return Response.json({ error: `${jumlahAnggota - terisi} anggota belum diisi kehadirannya.` }, { status: 400 });
  const n = await simpanAbsenEkstra({ extracurricularId: e.id, tanggal: hariWibIso(), materi, rows, olehNama: nama, olehPeran: "Pembina (tautan)", sumber: "PORTAL" });
  return Response.json({ ok: true, tersimpan: n }, { status: 201 });
}
