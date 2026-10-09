import { prisma } from "@/lib/prisma";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { penerimaLaporan } from "@/lib/pkl-server";
import { rapikanNomorWa } from "@/lib/spmb-form";

export const dynamic = "force-dynamic";

// Pembatas sederhana di memori: 3 kiriman per IP per 30 menit — formulir terbuka untuk umum.
const hitung = new Map<string, number[]>();
function lolos(ip: string) {
  const kini = Date.now(), a = (hitung.get(ip) ?? []).filter(t => kini - t < 30 * 60_000);
  if (a.length >= 3) { hitung.set(ip, a); return false; }
  a.push(kini); hitung.set(ip, a);
  if (hitung.size > 5000) hitung.clear();
  return true;
}
const teks = (v: unknown, maks: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, maks) : "");

/** FORMULIR "JADI MITRA PKL" (9 Okt 2026) — pemilik usaha mengusulkan tempatnya sebagai tempat PKL. Selalu tersimpan sebagai
 *  DUDI NONAKTIF bertanda `usulan`: tidak muncul di pilihan penempatan, peta, maupun logo web sebelum Humas mengaktifkannya.
 *  Nama yang sudah ada TIDAK dibuat ulang, dan jawabannya sama saja — supaya formulir ini tidak bisa dipakai menebak
 *  daftar mitra sekolah. */
export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "tanpa-ip";
    if (!lolos(ip)) return Response.json({ error: "Terlalu banyak kiriman. Coba lagi sekitar 30 menit lagi." }, { status: 429 });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (teks(b.situs, 50)) return Response.json({ ok: true }); // kolom jebakan robot
    const nama = teks(b.nama, 120), bidang = teks(b.bidang, 120), alamat = teks(b.alamat, 300), narahubung = teks(b.narahubung, 80);
    const wa = rapikanNomorWa(teks(b.wa, 30)), catatan = teks(b.catatan, 600);
    const kuota = Number.isInteger(b.kuota) && (b.kuota as number) >= 1 && (b.kuota as number) <= 200 ? (b.kuota as number) : null;
    const kolom: Record<string, string> = {};
    if (nama.length < 3) kolom.nama = "Isi nama usaha / instansi.";
    if (bidang.length < 3) kolom.bidang = "Isi bidang usahanya.";
    if (alamat.length < 10) kolom.alamat = "Isi alamat lengkap.";
    if (narahubung.length < 3) kolom.narahubung = "Isi nama yang bisa dihubungi.";
    if (!/^62\d{8,13}$/.test(wa)) kolom.wa = "Nomor WhatsApp belum benar.";
    if (Object.keys(kolom).length) return Response.json({ error: "Periksa isian yang ditandai.", kolom }, { status: 400 });
    const ada = await prisma.industryPartner.findFirst({ where: { name: { equals: nama, mode: "insensitive" } }, select: { id: true } });
    if (!ada) {
      const d = await prisma.industryPartner.create({
        data: { name: nama, industryField: bidang, address: alamat, contactPerson: narahubung, contactPhone: wa, quota: kuota, aktif: false, usulan: true, tampilPublik: false,
          notes: `Usulan lewat formulir Jadi Mitra PKL.${catatan ? ` Pesan: ${catatan}` : ""}` },
        select: { id: true },
      });
      kirimLatar(async () => kirimNotifikasi({
        userIds: await penerimaLaporan(null), jenis: "PKL", kunci: `mitra-usulan:${d.id}`,
        judul: "Usulan mitra PKL baru", isi: `${nama} (${bidang}) mengajukan diri sebagai tempat PKL.`, url: "/pusat-pkl/dudi?saring=USULAN",
      }));
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch { return Response.json({ error: "Gagal mengirim. Coba lagi." }, { status: 500 }); }
}
