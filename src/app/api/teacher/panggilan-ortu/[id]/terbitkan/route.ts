import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { aksesPanggilan } from "@/lib/panggilan-akses";
import { isiSuratPanggilan } from "@/lib/panggilan-ortu";
import { nomorSuratBerikutnya } from "@/lib/nomor-surat-berikutnya";
import { kirimLatar, kirimNotifikasi, orangTuaDari } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** Terbitkan panggilan menjadi SURAT KELUAR bernomor (B.11) — tercatat di Agenda Persuratan — lalu kabari orang tua. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const akses = await aksesPanggilan(session);
  if (!akses?.kelola) return Response.json({ error: "Khusus Kesiswaan/BK." }, { status: 403 });
  const { id } = await params;
  const p = await prisma.panggilanOrangTua.findUnique({
    where: { id },
    include: { student: { select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  if (!p) return Response.json({ error: "Panggilan tidak ditemukan." }, { status: 404 });
  if (p.status !== "DRAF") return Response.json({ error: "Panggilan ini sudah diterbitkan atau ditutup." }, { status: 409 });
  if (!p.jadwal || !p.tempat) return Response.json({ error: "Isi jadwal dan tempat pertemuan dulu." }, { status: 400 });
  const isi = isiSuratPanggilan({
    nama: p.student.user.name, kelas: p.student.class?.name ?? "-",
    uraian: p.tingkat === "MANUAL" ? p.alasan : `akumulasi poin pelanggaran ${p.poin} (${p.tingkat})`,
    periode: `semester ${p.semester}`, jadwal: p.jadwal, tempat: p.tempat, keperluan: p.keperluan ?? "Pembinaan kedisiplinan",
  });
  const sekarang = new Date();
  const nomor = await nomorSuratBerikutnya(isi.klasifikasi, sekarang);
  const surat = await prisma.$transaction(async tx => {
    const s = await tx.surat.create({
      data: {
        tipe: "KELUAR", nomor, tanggal: sekarang, pihak: isi.pihak, perihal: isi.perihal, klasifikasi: isi.klasifikasi,
        content: isi.html, penandaTangan: "Kepala SMK Al Munawwir IIBS", templateValue: "PGL_PELANGGARAN",
        keterangan: `Panggilan otomatis ${p.tingkat} — ${p.student.user.name}`,
      },
    });
    await tx.panggilanOrangTua.update({ where: { id }, data: { status: "TERBIT", suratId: s.id } });
    return s;
  });
  await logActivity(session, {
    action: "TERBITKAN_PANGGILAN_ORTU", entity: "PanggilanOrangTua", entityId: id,
    description: `Menerbitkan surat panggilan ${nomor} untuk orang tua ${p.student.user.name} (${p.tingkat})`,
  }).catch(() => {});
  kirimLatar(async () => {
    const ortu = (await orangTuaDari([p.student.id])).get(p.student.id) ?? [];
    if (!ortu.length) return;
    const jadwal = p.jadwal!.toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    await kirimNotifikasi({
      userIds: ortu, jenis: "POIN_PELANGGARAN", kunci: `panggilan-terbit:${id}`,
      judul: "Undangan ke sekolah dari Kesiswaan",
      isi: `Mohon hadir ${jadwal} WIB di ${p.tempat} terkait ${p.keperluan ?? "pembinaan"} ananda ${p.student.user.name}.`,
      url: "/dashboard/parent/poin", tag: `panggilan-${id}`,
    });
  });
  return Response.json({ ok: true, suratId: surat.id, nomor });
}
