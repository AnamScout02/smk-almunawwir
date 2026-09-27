import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { filterDaftarUjian, jumlahSiswaAktif, kelasPeserta, petaNamaKelas, tenggat, putarTokenBilaPerlu, putarTokenKegiatanBilaPerlu, pastikanTokenKegiatan, JEDA_TERPUTUS_MS } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** RUANG KENDALI UJIAN - padanan "CBT Admin" Bimasoft, tapi di dalam web yang sama.
 *
 * Beda dengan papan pantau per-ujian: halaman ini melihat SELURUH ujian sekaligus, supaya
 * pengawas/operator di ruang server tahu keadaan semua ruang ujian dalam satu layar - tanpa
 * membuka ujian satu per satu. Ringan & sering dipanggil (polling), jadi hanya menghitung
 * jumlah, bukan mengirim daftar siswa.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const filterGuru = await filterDaftarUjian(session);
    const lingkup = new URL(req.url).searchParams.get("lingkup") ?? "aktif";

    const sekarang = new Date();
    const batasLampau = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);
    const where = {
      ...(filterGuru ?? {}),
      ...(lingkup === "aktif" ? { endTime: { gte: batasLampau } } : {}),
    };

    const exams = await prisma.exam.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        teacher: { select: { user: { select: { name: true } } } },
        kegiatan: { select: { id: true, nama: true, singkatan: true, aktif: true, token: true, tokenLama: true, tokenDiperbarui: true, tokenOtomatisMenit: true } },
        _count: { select: { questions: true } },
        attempts: { select: { studentId: true, student: { select: { classId: true } }, startedAt: true, submittedAt: true, lastSeenAt: true, score: true, pelanggaran: true, tambahanMenit: true, terkunci: true } },
      },
      orderBy: [{ startTime: "desc" }],
      take: 100,
    });

    // Token berjangka diputar di sini — Ruang Kendali terbuka terus di layar operator selama ujian.
    for (const e of exams) {
      if (!e.isPublished || sekarang < e.startTime || sekarang > e.endTime) continue;
      const t = await putarTokenBilaPerlu(e);
      e.token = t.token; e.tokenDiperbarui = t.tokenDiperbarui;
    }
    // Token BERSAMA kegiatan ikut diputar & ditampilkan. Kalau sebuah kegiatan punya token bersama,
    // ITULAH yang dipakai peserta — token per-ujian tetap berlaku sebagai cadangan (20 Sep 2026).
    const kegDiputar = new Map<string, { token: string | null; berganti: string | null }>();
    for (const e of exams) {
      const k = e.kegiatan;
      if (!k || kegDiputar.has(k.id)) continue;
      // Kegiatan aktif dibuatkan token bersama sendiri kalau belum punya.
      k.token = await pastikanTokenKegiatan(k).catch(() => k.token);
      if (!k.token) continue;
      const t = await putarTokenKegiatanBilaPerlu(k).catch(() => null);
      const token = t?.token ?? k.token;
      const diperbarui = t?.tokenDiperbarui ?? k.tokenDiperbarui;
      kegDiputar.set(k.id, {
        token,
        berganti: k.tokenOtomatisMenit > 0 ? new Date(diperbarui.getTime() + k.tokenOtomatisMenit * 60_000).toISOString() : null,
      });
    }

    // Ujian bisa diikuti banyak kelas: nama & jumlah siswa dihitung dari semua kelas peserta.
    const [kelas, siswaPerKelas] = await Promise.all([
      petaNamaKelas(exams), jumlahSiswaAktif([...new Set(exams.flatMap(e => kelasPeserta(e)))]),
    ]);

    const ujian = exams.map(e => {
      let mengerjakan = 0, terputus = 0, selesai = 0, waktuHabis = 0, pelanggaran = 0, terkunci = 0;
      for (const a of e.attempts) {
        const p = Array.isArray(a.pelanggaran) ? (a.pelanggaran as unknown[]).length : 0;
        pelanggaran += p;
        if (a.submittedAt) { selesai += 1; continue; }
        const batas = tenggat(a.startedAt, e.duration, jendelaKelas(e, a.student.classId).endTime, a.tambahanMenit).getTime();
        if (a.terkunci) terkunci += 1;
        else if (sekarang.getTime() > batas) waktuHabis += 1;
        else if (sekarang.getTime() - a.lastSeenAt.getTime() > JEDA_TERPUTUS_MS) terputus += 1;
        else mengerjakan += 1;
      }
      // Susulan/remedial: peserta = daftar khusus, bukan seluruh kelas.
      const jumlahSiswa = e.pesertaIds?.length ? e.pesertaIds.length : kelasPeserta(e).reduce((n, k) => n + (siswaPerKelas.get(k) ?? 0), 0);
      const status = !e.isPublished ? "DRAFT"
        : sekarang < e.startTime ? "TERJADWAL"
        : sekarang > e.endTime ? "SELESAI" : "BERLANGSUNG";
      return {
        id: e.id, title: e.title, subject: e.subject, token: e.token, isPublished: e.isPublished,
        kegiatan: e.kegiatan,
        kelas: kelas.label(e), guru: e.teacher.user.name, jumlahSoal: e._count.questions,
        startTime: e.startTime, endTime: e.endTime, duration: e.duration,
        examkey: e.examkey, acakSoal: e.acakSoal, acakOpsi: e.acakOpsi, jumlahDikerjakan: e.jumlahDikerjakan,
        status, jumlahSiswa,
        belum: Math.max(0, jumlahSiswa - e.attempts.length),
        mengerjakan, terputus, selesai, waktuHabis, pelanggaran, terkunci,
        tokenOtomatisMenit: e.tokenOtomatisMenit,
        tokenBerganti: e.tokenOtomatisMenit > 0 ? new Date(e.tokenDiperbarui.getTime() + e.tokenOtomatisMenit * 60_000).toISOString() : null,
        // Token bersama kegiatan (kalau ada) — yang ini yang dibacakan ke peserta.
        tokenKegiatan: e.kegiatan?.id ? kegDiputar.get(e.kegiatan.id)?.token ?? null : null,
        tokenKegiatanBerganti: e.kegiatan?.id ? kegDiputar.get(e.kegiatan.id)?.berganti ?? null : null,
      };
    });

    const aktif = ujian.filter(u => u.status === "BERLANGSUNG");
    const ringkas = {
      ujianBerlangsung: aktif.length,
      mengerjakan: aktif.reduce((n, u) => n + u.mengerjakan, 0),
      terputus: aktif.reduce((n, u) => n + u.terputus, 0),
      waktuHabis: aktif.reduce((n, u) => n + u.waktuHabis, 0),
      selesai: aktif.reduce((n, u) => n + u.selesai, 0),
      pelanggaran: aktif.reduce((n, u) => n + u.pelanggaran, 0),
      terkunci: aktif.reduce((n, u) => n + u.terkunci, 0),
    };
    return Response.json({ ujian, ringkas, diperbarui: sekarang.toISOString() });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

