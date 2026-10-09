import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, sesiPkl, terisiPerDudi } from "@/lib/pkl-server";
import { keadaanMou } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

/** PETA PKL: titik tiap DUDI + jumlah siswa yang sedang PKL di sana. DUDI tanpa titik lokasi didaftar terpisah. */
export async function GET() {
  try {
    await sesiPkl();
    const [dudi, terisi] = await Promise.all([
      prisma.industryPartner.findMany({ where: { aktif: true }, select: { id: true, name: true, lat: true, lng: true, quota: true, kecamatan: true, kabupaten: true, industryField: true, mouEndDate: true }, orderBy: { name: "asc" } }),
      terisiPerDudi(),
    ]);
    const semua = dudi.map(d => ({ id: d.id, nama: d.name, lat: d.lat, lng: d.lng, kuota: d.quota, siswa: terisi.get(d.id) ?? 0, kecamatan: d.kecamatan, kabupaten: d.kabupaten, bidang: d.industryField, mou: keadaanMou(d.mouEndDate).kode }));
    const sah = (d: (typeof semua)[number]) => d.lat != null && d.lng != null && d.lat > -11.5 && d.lat < 6.5 && d.lng > 94 && d.lng < 142;
    return Response.json({ titik: semua.filter(sah), tanpaTitik: semua.filter(d => !sah(d)).map(d => ({ id: d.id, nama: d.nama, siswa: d.siswa })) });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
