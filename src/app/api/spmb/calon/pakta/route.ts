import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ttdDariPermintaan } from "@/lib/ttd-masuk";
import { aturanTahapan, calonDariTanda, PILIH_TAHAPAN } from "@/lib/spmb-tahapan-server";
import { hapusTtdPakta, simpanTtdPakta } from "@/lib/spmb-dokumen";
import { HUBUNGAN_WALI, bacaPakta, isiPakta, paktaTerbuka } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

/** TANDA TANGAN PAKTA oleh orang tua calon (tanpa akun) — kunci nomor + tanda di query string, badan = TTD
 *  (kanvas atau foto) + nama & hubungan. Sekali ditandatangani TERKUNCI; membuka ulang hanya lewat panitia.
 *  Teks yang disetujui disimpan sebagai salinan (`paktaTeks`). */
export async function PUT(req: NextRequest) {
  if (!checkRateLimit(`spmb-pakta:${getClientIp(req)}`, 15, 10 * 60_000)) {
    return Response.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const id = await calonDariTanda(sp.get("nomor"), sp.get("t"));
  if (!id) return Response.json({ error: "Tautan tidak sah." }, { status: 404 });

  const [a, aturan, s] = await Promise.all([
    prisma.admission.findUnique({ where: { id }, select: { ...PILIH_TAHAPAN, paktaAt: true } }),
    aturanTahapan(),
    getSettings(["spmb.pakta", "school.name"]),
  ]);
  if (!a) return Response.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
  const p = bacaPakta(s["spmb.pakta"]);
  if (!p.aktif) return Response.json({ error: "Surat pernyataan tidak dipakai tahun ini." }, { status: 409 });
  if (a.paktaAt) return Response.json({ error: "Surat pernyataan sudah ditandatangani. Hubungi panitia bila perlu diubah." }, { status: 409 });
  if (!paktaTerbuka(a, aturan)) return Response.json({ error: "Surat pernyataan dibuka saat tahap daftar ulang." }, { status: 409 });

  const h = await ttdDariPermintaan(req);
  if ("galat" in h) return Response.json({ error: h.galat }, { status: 400 });
  const nama = (h.isian.nama ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  const hubungan = (HUBUNGAN_WALI as readonly string[]).includes(h.isian.hubungan ?? "") ? h.isian.hubungan : "";
  if (nama.length < 3) return Response.json({ error: "Tulis nama lengkap orang tua / wali yang menandatangani." }, { status: 400 });
  if (!hubungan) return Response.json({ error: "Pilih hubungan dengan calon murid." }, { status: 400 });
  if (h.isian.setuju !== "1") return Response.json({ error: "Centang persetujuan atas isi surat pernyataan." }, { status: 400 });

  const berkas = await simpanTtdPakta(id, h.png);
  // updateMany + paktaAt null: dua kiriman bersamaan tidak saling menimpa — yang kalah berkasnya dibuang.
  const n = await prisma.admission.updateMany({
    where: { id, paktaAt: null },
    data: {
      paktaTtd: berkas, paktaNama: nama, paktaHubungan: hubungan, paktaAt: new Date(),
      paktaTeks: isiPakta(p, s["school.name"] || "SMK Al-Munawwir IIBS"),
    },
  });
  if (!n.count) { await hapusTtdPakta(berkas); return Response.json({ error: "Surat pernyataan sudah ditandatangani." }, { status: 409 }); }
  return Response.json({ ok: true });
}
