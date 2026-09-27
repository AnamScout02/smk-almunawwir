import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { muatRekapNilai } from "@/lib/rekap-nilai-ujian";
import { bukuRekapNilai, type ModeRekap } from "@/lib/rekap-nilai-excel";

export const dynamic = "force-dynamic";

/** Unduh rekap nilai .xlsx bergaya: `?kegiatanId=&mode=kelas|mapel|ringkasan&kelasId=<id|semua>&mapel=<nama|semua>`.
 * "semua" = satu sheet per kelas / per mapel. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const q = new URL(req.url).searchParams;
    const data = await muatRekapNilai(session, q.get("kegiatanId") ?? "");
    if (!data) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    const mode: ModeRekap = q.get("mode") === "mapel" ? "mapel" : q.get("mode") === "ringkasan" ? "ringkasan" : "kelas";
    const kelasId = q.get("kelasId") ?? "semua", mapel = q.get("mapel") ?? "semua";
    const s = await getSettings(["school.name"]);
    const buf = await bukuRekapNilai(data, { mode, kelasId, mapel, sekolah: s["school.name"] || "SMK Al Munawwir IIBS" });
    const bagian = mode === "kelas" ? (kelasId === "semua" ? "semua-kelas" : data.kelas.find(k => k.id === kelasId)?.nama ?? "kelas")
      : mode === "mapel" ? (mapel === "semua" ? "semua-mapel" : mapel) : "ringkasan";
    const nama = `rekap-nilai-${data.kegiatan.singkatan}-${bagian}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nama}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal membuat berkas Excel." }, { status: 500 });
  }
}
