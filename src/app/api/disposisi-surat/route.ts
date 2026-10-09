import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { kirimLatar } from "@/lib/push-server";
import { logActivity } from "@/lib/activity-log";
import { pimpinanSurat, sebutanSaya } from "@/lib/surat-berkas";
import { kabariTujuanDisposisi, pilihanTujuan } from "@/lib/disposisi-server";
import { petaTtd } from "@/lib/ttd";

export const dynamic = "force-dynamic";
const SIFAT = ["BIASA", "SEGERA", "SANGAT_SEGERA", "RAHASIA"];

/** DISPOSISI SURAT DARI HP (9 Okt 2026). Satu layar dua peran:
 *  - PIMPINAN (Kepala Sekolah / Admin): surat masuk yang BELUM didisposisi + riwayat yang ia tulis;
 *  - SEMUA guru & staf: disposisi yang DITUJUKAN ke dirinya / jabatannya, untuk ditindaklanjuti. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const [pimpinan, sebutan] = await Promise.all([pimpinanSurat(session), sebutanSaya(session)]);
    const pilihSurat = { id: true, nomor: true, tanggal: true, pihak: true, perihal: true, keterangan: true, fileUrl: true } as const;
    const [menunggu, riwayat, untukSaya, tujuan, ttd] = await Promise.all([
      pimpinan ? prisma.surat.findMany({ where: { tipe: "MASUK", disposisi: { none: {} } }, orderBy: { tanggal: "desc" }, take: 60, select: { ...pilihSurat, createdAt: true } }) : [],
      pimpinan ? prisma.disposisi.findMany({ where: { dariUserId: session.userId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, tanggal: true, tujuan: true, instruksi: true, sifat: true, status: true, tindakLanjut: true, batasWaktu: true, surat: { select: pilihSurat } } }) : [],
      prisma.disposisi.findMany({ where: { tujuan: { hasSome: sebutan } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 60, select: { id: true, tanggal: true, tujuan: true, instruksi: true, sifat: true, status: true, tindakLanjut: true, batasWaktu: true, dariNama: true, surat: { select: pilihSurat } } }),
      pimpinan ? pilihanTujuan() : { jabatan: [], pegawai: [] },
      pimpinan ? petaTtd([session.userId]).then(p => p.has(session.userId)) : false,
    ]);
    return Response.json({ pimpinan, punyaTtd: ttd, nama: session.name, menunggu, riwayat, untukSaya, tujuan });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat disposisi." }, { status: 500 }); }
}

/** Pimpinan menulis disposisi. `tandaTangani` = ia membubuhkan TTD pribadinya (tercetak di lembar disposisi). */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER"]);
    if (!(await pimpinanSurat(session))) return Response.json({ error: "Hanya Kepala Sekolah yang mendisposisi surat." }, { status: 403 });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const surat = typeof b.suratId === "string" ? await prisma.surat.findFirst({ where: { id: b.suratId, tipe: "MASUK" }, select: { id: true } }) : null;
    if (!surat) return Response.json({ error: "Surat tidak ditemukan." }, { status: 404 });
    const sah = await pilihanTujuan();
    const boleh = new Set([...sah.jabatan, ...sah.pegawai, "Arsip"]);
    const tujuan = [...new Set(Array.isArray(b.tujuan) ? b.tujuan.filter((x): x is string => typeof x === "string" && boleh.has(x)) : [])].slice(0, 20);
    const instruksi = typeof b.instruksi === "string" ? b.instruksi.trim().slice(0, 1000) : "";
    if (!tujuan.length) return Response.json({ error: "Pilih minimal satu tujuan." }, { status: 400 });
    if (instruksi.length < 3) return Response.json({ error: "Tulis instruksinya." }, { status: 400 });
    const batas = typeof b.batasWaktu === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.batasWaktu) ? new Date(`${b.batasWaktu}T00:00:00Z`) : null;
    const hanyaArsip = tujuan.length === 1 && tujuan[0] === "Arsip";
    const row = await prisma.disposisi.create({
      data: {
        suratId: surat.id, tanggal: new Date(), tujuan, instruksi, sifat: SIFAT.includes(b.sifat as string) ? (b.sifat as string) : "BIASA", batasWaktu: batas,
        dariNama: session.name, dariUserId: session.userId, inputById: session.userId, ditandatanganiAt: b.tandaTangani === true ? new Date() : null,
        // "Cukup diarsipkan" tidak menunggu tindak lanjut siapa pun.
        ...(hanyaArsip ? { status: "SELESAI", selesaiAt: new Date(), tindakLanjut: "Diarsipkan." } : {}),
      },
      select: { id: true, tujuan: true, sifat: true, instruksi: true, batasWaktu: true, surat: { select: { perihal: true } } },
    });
    await prisma.surat.update({ where: { id: surat.id }, data: { isRead: true } }).catch(() => {});
    await logActivity(session, { action: "CREATE", entity: "Disposisi", description: `Disposisi surat "${row.surat.perihal}" ke ${tujuan.join(", ")}${b.tandaTangani === true ? " (ditandatangani)" : ""}` }).catch(() => null);
    kirimLatar(() => kabariTujuanDisposisi(row));
    return Response.json({ ok: true, id: row.id }, { status: 201 });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan disposisi." }, { status: 500 }); }
}
