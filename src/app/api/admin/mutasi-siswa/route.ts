import { potretSiswa, catatRiwayatSiswa } from "@/lib/riwayat-induk";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { bakuNamaSekolah } from "@/lib/nama-sekolah";
import { toProperCaseName } from "@/lib/text";
import { emailDariNis, hashSandiBawaan, penghitungNis } from "@/lib/spmb-konversi";
import { buatSuratSiswa } from "@/lib/surat-siswa";
import { MANUAL_KELUAR, MANUAL_MASUK, mutasiTerbaru, periksaMutasi } from "@/lib/mutasi-siswa";

export const dynamic = "force-dynamic";
const teks = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const tanggal = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const TINGKAT: Record<number, string> = { 10: "X (Sepuluh)", 11: "XI (Sebelas)", 12: "XII (Dua Belas)" };

/** `?cari=` siswa aktif untuk dipilih · `?periksa=<studentId>` daftar periksa satu siswa · tanpa parameter: bahan formulir +
 *  mutasi terbaru (keluar & masuk) beserta sisa langkahnya. */
export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const q = req.nextUrl.searchParams;
    if (q.get("periksa")) {
      const p = await periksaMutasi(q.get("periksa") as string);
      return p ? Response.json(p) : Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
    }
    const cari = teks(q.get("cari"), 60);
    if (cari.length >= 2) {
      const s = await prisma.student.findMany({
        where: { studentStatus: "AKTIF", OR: [{ user: { name: { contains: cari, mode: "insensitive" } } }, { nis: { contains: cari } }, { nisn: { contains: cari } }] },
        select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } }, orderBy: { user: { name: "asc" } }, take: 12,
      });
      return Response.json({ siswa: s.map(x => ({ id: x.id, nis: x.nis, nama: x.user.name, kelas: x.class?.name ?? null })) });
    }
    const [jurusan, kelas, semua] = await Promise.all([
      prisma.major.findMany({ select: { id: true, code: true, name: true, nisCode: true }, orderBy: { name: "asc" } }),
      prisma.class.findMany({ select: { id: true, name: true, grade: true, majorId: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
      mutasiTerbaru(),
    ]);
    const terbaru = semua.slice(0, 60);
    return Response.json({ jurusan, kelas, terbaru });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat data mutasi." }, { status: 500 }); }
}

/** SATU PINTU MUTASI. KELUAR: status + tanggal + tujuan/alasan ke Buku Induk (otomatis masuk Buku Mutasi), surat keterangan
 *  pindah bernomor agenda TU, dan akun dikeluarkan dari semua perangkat. MASUK: akun + NIS (aturan yang sama dengan "Jadi
 *  Siswa" SPMB), kelas, data pindahan di Buku Induk, dan (opsional) surat kesediaan menerima. */
export async function POST(req: Request) {
  try {
    const session = await verifyBukuIndukFullAccess();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const tgl = tanggal(b.tanggal);
    if (!tgl) return Response.json({ error: "Isi tanggalnya." }, { status: 400 });
    if (tgl.getTime() > Date.now() + 31 * 86_400_000) return Response.json({ error: "Tanggal terlalu jauh di depan." }, { status: 400 });

    if (b.arah === "KELUAR") {
      const jenis = b.jenis === "KELUAR" ? "KELUAR" : "PINDAH";
      const tujuan = bakuNamaSekolah(teks(b.tujuan, 150)), alasan = teks(b.alasan, 300);
      if (jenis === "PINDAH" && tujuan.length < 3) return Response.json({ error: "Isi sekolah tujuan." }, { status: 400 });
      if (alasan.length < 3) return Response.json({ error: "Isi alasannya." }, { status: 400 });
      const s = typeof b.studentId === "string" ? await prisma.student.findUnique({ where: { id: b.studentId }, select: { id: true, userId: true, studentStatus: true, bukuIndukData: true, user: { select: { name: true } } } }) : null;
      if (!s) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
      if ((s.studentStatus ?? "AKTIF") !== "AKTIF") return Response.json({ error: `${s.user.name} sudah berstatus ${s.studentStatus?.toLowerCase()}.` }, { status: 409 });
      // Surat lebih dulu: kalau penomoran gagal, status siswa belum berubah dan petugas bisa mengulang tanpa data setengah jadi.
      let surat: { id: string; nomor: string } | null = null;
      if (jenis === "PINDAH" && b.buatSurat !== false) {
        surat = await buatSuratSiswa({ template: "MUT_KELUAR", studentId: s.id, tanggal: tgl, isi: { "SEKOLAH TUJUAN": tujuan, "ALASAN": alasan, "TANGGAL": tgl.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) } });
      }
      const lama = (s.bukuIndukData ?? {}) as Record<string, unknown>;
      const sebelumRiwayat = await potretSiswa(s.id);
      await prisma.student.update({
        where: { id: s.id },
        data: {
          studentStatus: jenis, exitDate: tgl,
          bukuIndukData: { ...lama, pindahDate: tgl.toISOString().slice(0, 10), transferTo: jenis === "PINDAH" ? tujuan : String(lama.transferTo ?? ""), alasanPindah: alasan,
            ...(surat ? { suratNo: surat.nomor, mutasiSuratId: surat.id } : teks(b.nomorSurat, 80) ? { suratNo: teks(b.nomorSurat, 80) } : {}), mutasiCentang: "" },
        },
      });
      await catatRiwayatSiswa(session, s.id, sebelumRiwayat, "Mutasi Siswa").catch(() => 0);
      await cabutSemuaSesiPengguna(s.userId, "MUTASI_KELUAR").catch(() => null);
      await logActivity(session, { action: "UPDATE", entity: "Student", description: `Mutasi keluar ${s.user.name}: ${jenis === "PINDAH" ? `pindah ke ${tujuan}` : "keluar"}${surat ? ` (surat ${surat.nomor})` : ""}` }).catch(() => null);
      return Response.json({ ok: true, studentId: s.id, surat }, { status: 201 });
    }

    if (b.arah === "MASUK") {
      const nama = toProperCaseName(teks(b.nama, 120)), asal = bakuNamaSekolah(teks(b.asal, 150)), alasan = teks(b.alasan, 300);
      const jk = b.gender === "L" || b.gender === "P" ? b.gender : "";
      const kelas = typeof b.classId === "string" ? await prisma.class.findUnique({ where: { id: b.classId }, select: { id: true, name: true, grade: true, majorId: true, major: { select: { id: true, code: true, nisCode: true } } } }) : null;
      const nisn = teks(b.nisn, 10).replace(/\D/g, "");
      const kolom: Record<string, string> = {};
      if (nama.length < 3) kolom.nama = "Isi nama lengkap.";
      if (!jk) kolom.gender = "Pilih jenis kelamin.";
      if (!kelas) kolom.classId = "Pilih kelas tujuan.";
      if (asal.length < 3) kolom.asal = "Isi sekolah asal.";
      if (nisn && nisn.length !== 10) kolom.nisn = "NISN harus 10 angka.";
      if (Object.keys(kolom).length) return Response.json({ error: "Periksa isian yang ditandai.", kolom }, { status: 400 });
      if (!kelas!.major?.nisCode) return Response.json({ error: `Jurusan ${kelas!.major?.code ?? ""} belum punya Kode Jurusan (NIS). Isi dulu di Kelola Jurusan.` }, { status: 409 });
      if (nisn && (await prisma.student.findUnique({ where: { nisn }, select: { id: true } }))) return Response.json({ error: "NISN ini sudah dipakai siswa lain.", kolom: { nisn: "Sudah terdaftar." } }, { status: 409 });
      const lahir = tanggal(b.birthDate);
      const [nis, sandi] = await Promise.all([penghitungNis(), hashSandiBawaan()]);
      let dibuat: { id: string; nis: string; email: string } | null = null;
      for (let coba = 0; coba < 5 && !dibuat; coba++) {
        const nomor = nis.berikutnya(kelas!.majorId, kelas!.major!.nisCode as string), email = emailDariNis(nomor);
        try {
          dibuat = await prisma.$transaction(async tx => {
            const u = await tx.user.create({ data: { name: nama, email, password: sandi, role: "STUDENT" } });
            const st = await tx.student.create({
              data: {
                userId: u.id, nis: nomor, nisn: nisn || null, majorId: kelas!.majorId, classId: kelas!.id, enrollYear: tgl.getUTCFullYear(), gender: jk, studentStatus: "AKTIF",
                birthPlace: teks(b.birthPlace, 80) || null, birthDate: lahir, address: teks(b.address, 300) || null, parentName: teks(b.parentName, 120) ? toProperCaseName(teks(b.parentName, 120)) : null,
                parentPhone: teks(b.parentPhone, 30) || null, previousSchool: asal,
                bukuIndukData: { pindahanDari: asal, alasanPindahKe: alasan, diterimaDate: tgl.toISOString().slice(0, 10), tingkatMasuk: TINGKAT[kelas!.grade] ?? String(kelas!.grade),
                  rombel: /(\d+)\s*$/.exec(kelas!.name)?.[1] ?? "", kelasAsal: teks(b.kelasAsal, 40), masukSuratNo: teks(b.nomorSuratAsal, 80) },
              },
            });
            return { id: st.id, nis: nomor, email };
          });
        } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; } // NIS/email bentrok → nomor berikutnya
      }
      if (!dibuat) return Response.json({ error: "Gagal menerbitkan NIS. Coba lagi." }, { status: 500 });
      let surat: { id: string; nomor: string } | null = null;
      if (b.buatSurat === true) {
        surat = await buatSuratSiswa({ template: "MUT_MASUK", studentId: dibuat.id, tanggal: tgl, isi: { "SEKOLAH ASAL": asal }, pihak: `Yth. Kepala ${asal}` }).catch(() => null);
        if (surat) await prisma.student.update({ where: { id: dibuat.id }, data: { bukuIndukData: { ...(await prisma.student.findUnique({ where: { id: dibuat.id }, select: { bukuIndukData: true } }))!.bukuIndukData as object, mutasiSuratId: surat.id, mutasiSuratNomor: surat.nomor } } });
      }
      await logActivity(session, { action: "CREATE", entity: "Student", description: `Mutasi masuk ${nama} dari ${asal} ke ${kelas!.name} (NIS ${dibuat.nis})` }).catch(() => null);
      return Response.json({ ok: true, studentId: dibuat.id, nis: dibuat.nis, email: dibuat.email, surat }, { status: 201 });
    }
    return Response.json({ error: "Arah mutasi tidak dikenali." }, { status: 400 });
  } catch (e) { lemparBilaPengalihan(e); console.error(e); return Response.json({ error: e instanceof Error && e.message.startsWith("Templat") ? e.message : "Gagal menyimpan mutasi." }, { status: 500 }); }
}

/** Centang langkah manual (Dapodik, berkas, surat) — hanya kunci yang dikenal. */
export async function PUT(req: Request) {
  try {
    await verifyTasAccess();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const s = typeof b.studentId === "string" ? await prisma.student.findUnique({ where: { id: b.studentId }, select: { id: true, bukuIndukData: true } }) : null;
    if (!s) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
    const sah = new Set<string>([...MANUAL_KELUAR, ...MANUAL_MASUK].map(m => m.kunci));
    const centang = [...new Set(Array.isArray(b.centang) ? b.centang.filter((x): x is string => typeof x === "string" && sah.has(x)) : [])];
    await prisma.student.update({ where: { id: s.id }, data: { bukuIndukData: { ...((s.bukuIndukData ?? {}) as object), mutasiCentang: centang.join(",") } } });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan." }, { status: 500 }); }
}
