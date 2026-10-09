import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { kodeDariNomor, rapikanKode } from "@/lib/spmb-perujuk";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I, O, 0, 1 — mudah tertukar saat dibaca

/** Membuatkan kode perujuk untuk SELURUH siswa aktif atau seluruh guru/pegawai sekaligus.
 *
 *  Dua bentuk kode, dan pilihannya PENTING:
 *  - `angka` (BAWAAN): ANGKA NIS/NIP saja, tanda baca dibuang — `924/001.10.2.1` → `9240011021`
 *               (permintaan user 2 Okt 2026). Diuji ke data nyata: 1.180 NIS → 1.180 kode unik,
 *               nol tabrakan. Bukan nomor kartu gerbang, karena pemindai mencocokkan NIS persis.
 *               NIP `TMP-004` yang hanya menyisakan `004` otomatis memakai bentuk `TMP004`.
 *  - `berakhiran`: ditambah "-" + 4 karakter acak, untuk yang ingin kode tidak bisa dicocokkan
 *               balik ke NIS sama sekali.
 *
 *  Aman ditekan berulang: yang sudah punya baris perujuk DILEWATI, bukan dibuat ganda. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json();
    const jenis = b?.jenis === "PEGAWAI" ? "PEGAWAI" : "SISWA";
    const bentuk = b?.bentuk === "berakhiran" ? "berakhiran" : "angka";

    const sudah = new Set((await prisma.perujukSpmb.findMany({ select: { kode: true, studentId: true, userId: true } }))
      .flatMap(p => [p.kode, p.studentId && `s:${p.studentId}`, p.userId && `u:${p.userId}`].filter(Boolean) as string[]));

    type Calon = { dasar: string; nama: string; studentId?: string; userId?: string };
    let calon: Calon[] = [];

    if (jenis === "SISWA") {
      const siswa = await prisma.student.findMany({
        where: { studentStatus: "AKTIF", nis: { not: "" } },
        select: { id: true, nis: true, user: { select: { name: true } } },
      });
      calon = siswa.filter(x => x.nis.trim() && !sudah.has(`s:${x.id}`))
        .map(x => ({ dasar: x.nis.trim(), nama: x.user.name, studentId: x.id }));
    } else {
      // Pegawai: NIP dari baris Teacher. Staf TAS tidak punya baris Teacher maupun NIP (CLAUDE.md #93) — dulu
      // mereka TERLEWAT sehingga kartu referralnya tidak pernah muncul (laporan user 8 Okt 2026: Lutfiatul Amila
      // dkk.). Sekarang ikut dibuatkan dengan kode 6 angka acak (`dasar` kosong), tanpa membuat baris Teacher palsu.
      const guru = await prisma.teacher.findMany({
        where: { nip: { not: "" } },
        select: { nip: true, userId: true, user: { select: { name: true } } },
      });
      calon = guru.filter(x => x.nip.trim() && !sudah.has(`u:${x.userId}`))
        .map(x => ({ dasar: x.nip.trim(), nama: x.user.name, userId: x.userId }));
      const staf = await prisma.user.findMany({
        where: { role: "TAS", teacher: null }, select: { id: true, name: true },
      });
      calon.push(...staf.filter(x => !sudah.has(`u:${x.id}`)).map(x => ({ dasar: "", nama: x.name, userId: x.id })));
    }

    const akhiran = () => Array.from({ length: 4 }, () => HURUF[randomInt(HURUF.length)]).join("");
    const baris: { kode: string; nama: string; jenis: string; studentId?: string; userId?: string }[] = [];
    const dipakai = new Set(sudah);

    for (const c of calon) {
      const acak6 = () => String(randomInt(100000, 1000000));
      const dasar = c.dasar ? kodeDariNomor(c.dasar) : "";
      let kode = !dasar ? acak6() : rapikanKode(bentuk === "angka" ? dasar : `${dasar}-${akhiran()}`);
      let coba = 0;
      while (dipakai.has(kode) && coba < 20) { kode = !dasar ? acak6() : rapikanKode(`${dasar}-${akhiran()}`); coba++; }
      if (dipakai.has(kode)) continue;   // menyerah: kode itu memang sudah dipakai orang lain
      dipakai.add(kode);
      baris.push({ kode, nama: c.nama, jenis, studentId: c.studentId, userId: c.userId });
    }

    if (baris.length) await prisma.perujukSpmb.createMany({ data: baris, skipDuplicates: true });
    await logActivity(session, {
      action: "CREATE", entity: "PerujukSpmb",
      description: `Membuat ${baris.length} kode perujuk SPMB (${jenis}, bentuk ${bentuk})`,
    });
    return NextResponse.json({ ok: true, dibuat: baris.length, dilewati: calon.length - baris.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal membuat kode massal" }, { status: 500 });
  }
}
