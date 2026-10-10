import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { FOLDER_BERKAS_SISWA, MAKS_BERKAS, MIME_BERKAS, hakBerkasSiswa } from "@/lib/berkas-siswa";
import { JENIS_BERKAS_SISWA, labelBerkasSiswa } from "@/lib/berkas-siswa-jenis";

export const dynamic = "force-dynamic";
const idAman = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{10,40}$/i.test(v) ? v : "");

/** Daftar berkas satu siswa (+ dokumen pendaftaran SPMB-nya, hanya dibaca). */
export async function GET(req: Request) {
  try {
    const session = await verifySession();
    const studentId = idAman(new URL(req.url).searchParams.get("studentId"));
    if (!studentId) return Response.json({ error: "Siswa tidak dikenali." }, { status: 400 });
    const hak = await hakBerkasSiswa(session, studentId);
    if (!hak.lihat) return Response.json({ error: "Tidak berwenang." }, { status: 403 });
    const [berkas, spmb] = await Promise.all([
      prisma.berkasSiswa.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, select: { id: true, jenis: true, keterangan: true, mime: true, ukuran: true, diunggahOleh: true, createdAt: true } }),
      prisma.admission.findFirst({ where: { studentId }, select: { nomor: true, ijazahUrl: true, kkUrl: true, ktpWaliUrl: true, fotoUrl: true, dokumenLainUrl: true } }),
    ]);
    return Response.json({ berkas, spmb, kelola: hak.kelola });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat berkas." }, { status: 500 }); }
}

/** Unggah satu berkas (foto yang sudah dikecilkan di peramban, atau PDF) ke folder rahasia siswa itu. */
export async function POST(req: Request) {
  try {
    const session = await verifySession();
    const f = await req.formData();
    const studentId = idAman(f.get("studentId")), jenis = String(f.get("jenis") ?? ""), file = f.get("file");
    const keterangan = String(f.get("keterangan") ?? "").trim().slice(0, 120) || null;
    if (!studentId || !JENIS_BERKAS_SISWA.some(j => j.kunci === jenis)) return Response.json({ error: "Pilih jenis berkas." }, { status: 400 });
    if (!(await hakBerkasSiswa(session, studentId)).kelola) return Response.json({ error: "Hanya Tata Usaha / Operator Sekolah yang dapat mengunggah berkas siswa." }, { status: 403 });
    const siswa = await prisma.student.findUnique({ where: { id: studentId }, select: { nis: true, user: { select: { name: true } } } });
    if (!siswa) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Berkas tidak terbaca." }, { status: 400 });
    if (file.size > MAKS_BERKAS) return Response.json({ error: "Berkas lebih dari 6 MB." }, { status: 400 });
    const ext = Object.entries(MIME_BERKAS).find(([, m]) => m === file.type)?.[0];
    if (!ext) return Response.json({ error: "Hanya foto (JPG/PNG/WebP) atau PDF." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const sah = ext === "pdf" ? buf.subarray(0, 4).toString() === "%PDF" : ext === "png" ? buf[0] === 0x89 && buf[1] === 0x50
      : ext === "webp" ? buf.subarray(8, 12).toString() === "WEBP" : buf[0] === 0xff && buf[1] === 0xd8;
    if (!sah) return Response.json({ error: "Isi berkas tidak sesuai jenisnya." }, { status: 400 });
    const nama = `${Date.now()}-${randomBytes(9).toString("hex")}.${ext}`;
    await mkdir(join(FOLDER_BERKAS_SISWA, studentId), { recursive: true });
    await writeFile(join(FOLDER_BERKAS_SISWA, studentId, nama), buf);
    const baris = await prisma.berkasSiswa.create({ data: { studentId, jenis, keterangan, berkas: nama, mime: MIME_BERKAS[ext], ukuran: buf.length, diunggahOleh: session.name }, select: { id: true } });
    await logActivity(session, { action: "CREATE", entity: "BerkasSiswa", entityId: baris.id, description: `${session.name} mengunggah berkas ${labelBerkasSiswa(jenis)} milik "${siswa.user.name}" (${siswa.nis})` });
    return Response.json({ ok: true, id: baris.id }, { status: 201 });
  } catch (e) { lemparBilaPengalihan(e); console.error("[berkas siswa unggah]", e); return Response.json({ error: "Gagal menyimpan berkas." }, { status: 500 }); }
}
