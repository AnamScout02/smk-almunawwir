import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { catatPresensiPegawai, pegawaiDariKartu } from "@/lib/presensi-pegawai";

export const dynamic = "force-dynamic";

/** Absensi fisik via scan QR/barcode kartu tanda siswa (kartu sudah ada — QR-nya berisi NIS
 * mentah, lihat src/app/api/admin/kartu-tanda/route.ts `generateQrWithLogoDataUrl(p.identifier)`).
 * Scanner USB/laser umum berlaku sbg keyboard (ketik lalu Enter) — pola sama persis dgn
 * "Scan Kartu Anggota" di Perpustakaan (PerpustakaanManager.tsx handleScanCard).
 *
 * Akses SENGAJA lebih longgar dari modul TU lain (bukan verifyTasAccess()) — operasi ini cuma
 * "tandai hadir", risikonya rendah (gampang dikoreksi wali kelas kalau salah), dan yang perlu
 * mengoperasikan alat scan di gerbang bisa siapa saja yg piket (guru piket, security, TU) — bukan
 * cuma staf TU. Kalau nanti perlu dibatasi ke jabatan tertentu (mis. "Guru Piket"/"Security"),
 * tinggal ganti verifyRole di sini jadi assertJabatan pola lib/<nama>-guard.ts (lihat CLAUDE.md
 * gotcha #13) — sengaja belum dibatasi granular krn user cuma minta "disiapkan dulu utk dipakai
 * nanti", scope jabatan blm ditentukan.
 *
 * TIDAK menimpa status yang sudah ada (kalau wali kelas sudah input manual, atau siswa sudah scan
 * sebelumnya hari itu) — scan cuma MENGISI kalau benar2 belum ada record Attendance hari itu,
 * supaya tidak diam2 menimpa keputusan manual wali kelas (mis. sudah ditandai SAKIT lalu ke-scan
 * tanpa sengaja oleh orang lain yg pegang kartunya). */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { code } = await req.json() as { code?: string };
    const nis = (code ?? "").trim();
    if (!nis) return Response.json({ error: "Kode kosong" }, { status: 400 });

    const student = await prisma.student.findUnique({
      where: { nis },
      select: {
        id: true, nis: true, studentStatus: true,
        user: { select: { name: true, avatar: true } },
        class: { select: { name: true } },
      },
    });
    if (!student) {
      // Bukan kartu siswa → coba kartu pegawai (NIP atau awalan email). Presensi pegawai memakai aturan
      // sendiri di src/lib/presensi-pegawai.ts: pindaian pertama jam masuk, berikutnya jam pulang.
      const pegawai = await pegawaiDariKartu(nis);
      if (!pegawai) return Response.json({ error: "Kartu tidak dikenali — NIS/NIP tidak ditemukan", code: nis }, { status: 404 });
      if (pegawai.nonaktif) return Response.json({ error: `${pegawai.nama} sudah tidak aktif sebagai pegawai` }, { status: 409 });
      const p = await catatPresensiPegawai(pegawai.userId, "KARTU");
      const info = { name: pegawai.nama, avatar: pegawai.avatar, nis: nis, className: pegawai.keterangan };
      if (p.hasil === "LIBUR") return Response.json({ error: "Hari ini libur — presensi pegawai tidak dicatat." }, { status: 409 });
      if (p.hasil === "TERKUNCI") return Response.json({ jenis: "PEGAWAI", result: "already", status: p.status, student: info });
      if (p.hasil === "SUDAH_ADA") return Response.json({ jenis: "PEGAWAI", result: "already", status: "HADIR", student: info, jamMasuk: p.jamMasuk, jamPulang: p.jamPulang });
      return Response.json({ jenis: "PEGAWAI", result: "created", status: p.hasil === "MASUK" ? "MASUK" : "PULANG", student: info, jam: p.jam }, { status: 201 });
    }
    if (student.studentStatus && student.studentStatus !== "AKTIF") {
      return Response.json({ error: `${student.user.name} berstatus ${student.studentStatus} (bukan siswa aktif)` }, { status: 409 });
    }

    // Batas hari pakai pola sama persis dgn AbsensiSiswaManager/journal route: string YYYY-MM-DD
    // (zona UTC saat di-parse Date) supaya konsisten dgn CARA SEMUA Attendance lain di app ini
    // disimpan/dibandingkan — bukan cuma "hari ini menurut jam server".
    const todayStr = new Date().toISOString().split("T")[0];
    const dayStart = new Date(todayStr);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const existing = await prisma.attendance.findFirst({
      where: { studentId: student.id, date: { gte: dayStart, lt: dayEnd } },
    });

    const studentInfo = { name: student.user.name, avatar: student.user.avatar, nis: student.nis, className: student.class?.name ?? "—" };

    const catatPindai = (hasil: string) => prisma.absensiPindaiLog.create({
      data: { studentId: student.id, tanggal: dayStart, metode: "KARTU", hasil, dicatatOleh: session.userId, ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null },
    }).catch(() => null);

    if (existing) {
      await catatPindai("SUDAH_ADA");
      return Response.json({ result: "already", status: existing.status, student: studentInfo });
    }

    await prisma.attendance.create({ data: { studentId: student.id, date: dayStart, status: "HADIR" } });
    await catatPindai("DIBUAT");

    return Response.json({ result: "created", status: "HADIR", student: studentInfo }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal memproses scan" }, { status: 500 });
  }
}
