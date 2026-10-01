import "server-only";
import { prisma } from "@/lib/prisma";
import { slugEvent, JENIS_EVENT, TINGKAT_EVENT } from "@/lib/event-guard";

/* Pembantu bersama POST & PUT event. SENGAJA di lib, bukan diekspor dari route.ts — `next build`
   menolak ekspor selain handler HTTP & konfigurasi dari route (CLAUDE.md #26). */

/** Isian bersama POST & PUT. Mengembalikan pesan galat, atau data siap simpan. */
export async function susunEvent(b: Record<string, unknown>, idLama?: string) {
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const deskripsi = String(b.deskripsi ?? "").trim().slice(0, 5000);
  if (!judul) return { galat: "Nama event wajib diisi." as const };
  if (!deskripsi) return { galat: "Deskripsi wajib diisi — ini yang dibaca calon peserta." as const };

  const tgl = (v: unknown) => {
    const t = String(v ?? "").trim();
    if (!t) return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00.000Z` : t);
    return isNaN(d.getTime()) ? null : d;
  };
  const berbayar = b.berbayar === true || b.berbayar === "true";
  const biaya = berbayar ? Math.max(0, Math.round(Number(b.biaya ?? 0) || 0)) : null;

  // Slug unik: judul yang sama (mis. lomba tahunan) tetap bisa dibuat, dibedakan akhiran angka.
  let slug = slugEvent(judul);
  for (let i = 2; i < 50; i++) {
    const ada = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (!ada || ada.id === idLama) break;
    slug = `${slugEvent(judul)}-${i}`;
  }

  return {
    data: {
      judul, slug, deskripsi,
      penyelenggara: String(b.penyelenggara ?? "").trim().slice(0, 150) || "SMK Al Munawwir IIBS",
      milikSekolah: b.milikSekolah === true || b.milikSekolah === "true",
      jenis: JENIS_EVENT.includes(String(b.jenis)) ? String(b.jenis) : "LOMBA",
      tingkat: TINGKAT_EVENT.includes(String(b.tingkat)) ? String(b.tingkat) : "SEKOLAH",
      syarat: String(b.syarat ?? "").trim().slice(0, 3000) || null,
      fasilitas: String(b.fasilitas ?? "").trim().slice(0, 2000) || null,
      berbayar, biaya,
      biayaCatatan: String(b.biayaCatatan ?? "").trim().slice(0, 300) || null,
      rekening: String(b.rekening ?? "").trim().slice(0, 200) || null,
      mulai: tgl(b.mulai), selesai: tgl(b.selesai), tutupDaftar: tgl(b.tutupDaftar),
      posterUrl: String(b.posterUrl ?? "").trim().slice(0, 500) || null,
      panduanUrl: String(b.panduanUrl ?? "").trim().slice(0, 500) || null,
      tautanLuar: String(b.tautanLuar ?? "").trim().slice(0, 500) || null,
      kontak: String(b.kontak ?? "").trim().slice(0, 200) || null,
      jurusanIds: Array.isArray(b.jurusanIds) ? (b.jurusanIds as unknown[]).map(String).filter(Boolean).slice(0, 50) : [],
      aktif: b.aktif !== false && b.aktif !== "false",
      tampilPublik: b.tampilPublik !== false && b.tampilPublik !== "false",
    },
  };
}
