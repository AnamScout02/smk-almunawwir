import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { balasanExcelBanyakSheet, type SelBaris } from "@/lib/ekspor-excel";
import { rekapSeragam } from "@/lib/spmb-seragam";

export const dynamic = "force-dynamic";

/** Rekap pesanan seragam — layar (?format=json) & Excel untuk penjahit/vendor (src/lib/spmb-seragam.ts).
 *  Ringkasan = jumlah per item × ukuran × jenis kelamin; Rincian = satu baris per calon. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const r = await rekapSeragam(req.nextUrl.searchParams.get("gelombangId") || undefined);
    if (req.nextUrl.searchParams.get("format") === "json") return NextResponse.json(r);

    const ringkasan: SelBaris[] = [];
    for (const n of r.item) {
      for (const [u, j] of Object.entries(r.hitung[n] ?? {})) {
        ringkasan.push([n, u, j.L, j.P, ...(r.adaTanpaJk ? [j["?"]] : []), j.L + j.P + j["?"]]);
      }
    }
    return balasanExcelBanyakSheet(`pesanan-seragam-spmb-${new Date().toISOString().slice(0, 10)}`, [
      { nama: "Ringkasan", headers: ["Item", "Ukuran", "Putra", "Putri", ...(r.adaTanpaJk ? ["Tanpa keterangan"] : []), "Jumlah"], rows: ringkasan },
      {
        nama: "Rincian",
        headers: ["No", "Nomor Pendaftaran", "Nama", "L/P", "Jurusan", "Gelombang", "Status", ...r.item, "Catatan"],
        rows: r.rincian.map((x, i) => [i + 1, x.nomor, x.nama, x.jk === "?" ? "" : x.jk, x.jurusan, x.gelombang, x.status, ...x.ukuran, x.catatan]),
      },
    ]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}
