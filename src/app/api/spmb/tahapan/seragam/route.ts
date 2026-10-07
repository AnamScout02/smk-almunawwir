import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { balasanExcelBanyakSheet, type SelBaris } from "@/lib/ekspor-excel";
import { LABEL_STATUS } from "@/lib/spmb-status";
import { bacaSetelanSeragam, type IsiSeragam } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

/** Rekap pesanan seragam (6 Okt 2026) — layar (?format=json) & Excel untuk penjahit/vendor.
 *  Ringkasan = jumlah per item × ukuran; Rincian = satu baris per calon. Calon yang DITOLAK tidak ikut. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId") || undefined;
    const [baris, s] = await Promise.all([
      prisma.admission.findMany({
        where: { seragamAt: { not: null }, status: { notIn: ["DITOLAK", "REJECTED"] }, ...(gelombangId ? { gelombangId } : {}) },
        orderBy: [{ gelombang: { urutan: "asc" } }, { fullName: "asc" }],
        select: { nomor: true, fullName: true, gender: true, chosenMajor: true, status: true, seragam: true, seragamAt: true, gelombang: { select: { nama: true } } },
      }),
      getSettings(["spmb.seragam"]),
    ]);
    const setelan = bacaSetelanSeragam(s["spmb.seragam"]);
    const item = setelan.item.map(i => i.nama);

    const hitung: Record<string, Record<string, number>> = {};
    for (const i of setelan.item) hitung[i.nama] = Object.fromEntries(i.ukuran.map(u => [u.label, 0]));
    const rincian = baris.map(b => {
      const isi = (b.seragam ?? { pilihan: [] }) as IsiSeragam;
      const ukuran = item.map(n => isi.pilihan?.find(p => p.item === n)?.ukuran ?? "");
      ukuran.forEach((u, k) => { if (u) { hitung[item[k]] ??= {}; hitung[item[k]][u] = (hitung[item[k]][u] ?? 0) + 1; } });
      return {
        nomor: b.nomor ?? "", nama: b.fullName, gender: b.gender ?? "", jurusan: b.chosenMajor, gelombang: b.gelombang?.nama ?? "",
        status: LABEL_STATUS[b.status] ?? b.status, ukuran, catatan: isi.catatan ?? "",
      };
    });

    if (req.nextUrl.searchParams.get("format") === "json") {
      return NextResponse.json({ item, hitung, jumlah: rincian.length, rincian });
    }

    const ringkasan: SelBaris[] = [];
    for (const n of item) for (const [u, j] of Object.entries(hitung[n] ?? {})) ringkasan.push([n, u, j]);
    return balasanExcelBanyakSheet(`pesanan-seragam-spmb-${new Date().toISOString().slice(0, 10)}`, [
      { nama: "Ringkasan", headers: ["Item", "Ukuran", "Jumlah"], rows: ringkasan },
      {
        nama: "Rincian",
        headers: ["No", "Nomor Pendaftaran", "Nama", "L/P", "Jurusan", "Gelombang", "Status", ...item, "Catatan"],
        rows: rincian.map((r, i) => [i + 1, r.nomor, r.nama, r.gender, r.jurusan, r.gelombang, r.status, ...r.ukuran, r.catatan]),
      },
    ]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}
