import { getSettings } from "@/lib/site-settings";
import { rapikanNomorWa } from "@/lib/spmb-form";

// Route publik polos yang menyentuh Prisma WAJIB dynamic (CLAUDE.md #1).
export const dynamic = "force-dynamic";

/** Nomor WhatsApp untuk tombol melayang di situs publik — DARI PENGATURAN, bukan ditulis mati
 *  (temuan user 1 Oktober 2026: nomor di tombol tidak ikut berubah saat pengaturan diganti).
 *  `umum` = Konten Halaman → Nomor Telepon / WhatsApp; `spmb` = Pengaturan SPMB → WhatsApp panitia
 *  (dipakai khusus di halaman SPMB bila diisi). Keduanya diseragamkan ke bentuk 62… di sini supaya
 *  admin boleh menulis 0838-7820-3670 maupun +62 838 …. */
export async function GET() {
  const s = await getSettings(["contact.phone", "spmb.kontakWa", "spmb.kontakNama"]);
  return Response.json({
    umum: rapikanNomorWa(s["contact.phone"] ?? ""),
    spmb: rapikanNomorWa(s["spmb.kontakWa"] ?? ""),
    namaSpmb: s["spmb.kontakNama"] ?? "",
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
