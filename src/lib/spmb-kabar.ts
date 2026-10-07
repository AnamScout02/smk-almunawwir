import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { pushTersedia } from "@/lib/push-server";
import { lahirIso, tandaFormulir } from "@/lib/spmb-tanda";
import { aturanTahapan, denganBayar, PILIH_TAHAPAN, ringkasBayar, setelanBayar, tahapanDari, tautanTahapan } from "@/lib/spmb-tahapan-server";
import { bacaMpls } from "@/lib/spmb-tahapan";

/** KABAR KE CALON SISWA (6 Oktober 2026) — calon TANPA akun, jadi tidak lewat `kirimNotifikasi` (yang terikat User).
 *  Langganan push per pendaftar disimpan di `LanggananSpmb`; tiap kabar dicatat di `KabarSpmb` dengan `kunci` unik
 *  (satu kejadian hanya dikabarkan sekali, pola CLAUDE.md #31) dan juga tampil di halaman tahapan calon.
 *  Dari route API panggil lewat `kirimLatar(() => …)` SETELAH data tersimpan. */

export async function kabariCalon(admissionId: string, k: { kunci: string; judul: string; isi: string }): Promise<boolean> {
  try {
    await prisma.kabarSpmb.create({ data: { admissionId, kunci: k.kunci, judul: k.judul, isi: k.isi } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false; // sudah pernah dikabarkan
    throw e;
  }
  if (!pushTersedia()) return true;
  const [a, langganan] = await Promise.all([
    prisma.admission.findUnique({ where: { id: admissionId }, select: { nomor: true, birthDate: true } }),
    prisma.langgananSpmb.findMany({ where: { admissionId } }),
  ]);
  if (!a?.nomor || !langganan.length) return true;
  const url = tautanTahapan(a.nomor, tandaFormulir(a.nomor, lahirIso(a.birthDate))).replace(/^https?:\/\/[^/]+/, "");
  const muatan = JSON.stringify({ judul: k.judul, isi: k.isi, url, tag: `spmb-${admissionId}` });
  let berhasil = 0;
  const mati: string[] = [];
  await Promise.all(langganan.map(async l => {
    try {
      await webpush.sendNotification({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } }, muatan,
        { TTL: 24 * 3600, urgency: "normal", timeout: 10_000 });
      berhasil++;
    } catch (e) {
      const kode = (e as { statusCode?: number }).statusCode;
      if (kode === 404 || kode === 410) mati.push(l.id);
    }
  }));
  await Promise.all([
    mati.length ? prisma.langgananSpmb.deleteMany({ where: { id: { in: mati } } }) : null,
    prisma.kabarSpmb.update({ where: { kunci: k.kunci }, data: { perangkat: berhasil } }),
  ]).catch(() => null);
  return true;
}

/** Setelah panitia mengubah satu tahap: kabar = peristiwa + tahap berikutnya (dengan jadwal), atau ucapan MPLS bila tuntas. */
export async function kabarTahapan(admissionId: string, peristiwa: { kunci: string; judul: string; isi: string }) {
  const [mentah, aturan, setBayar, petaBayar, s] = await Promise.all([
    prisma.admission.findUnique({
      where: { id: admissionId },
      select: { ...PILIH_TAHAPAN, id: true, gelombang: { select: { jadwalTahap: true } }, sesi: true },
    }),
    aturanTahapan(), setelanBayar(), ringkasBayar([admissionId]),
    getSettings(["spmb.mpls", "spmb.tahun", "school.name"]),
  ]);
  if (!mentah) return;
  const a = denganBayar(mentah, setBayar, petaBayar);
  const { tahap, tuntas } = tahapanDari(a, aturan, a.gelombang?.jadwalTahap, a.sesi);
  if (tuntas) {
    const m = bacaMpls(s["spmb.mpls"]);
    await kabariCalon(admissionId, {
      kunci: `spmb-mpls:${admissionId}`,
      judul: "Selamat! Resmi peserta MPLS",
      isi: `Seluruh tahapan selesai. Anda resmi mengikuti MPLS Tahun Ajaran ${s["spmb.tahun"]} ${s["school.name"] || "SMK Al-Munawwir IIBS"}.` +
        (m.mulai ? ` Jadwal: ${m.mulai}${m.jam ? `, ${m.jam}` : ""}.` : ""),
    });
    return;
  }
  const lanjut = tahap.find(t => t.status === "BERJALAN" || t.status === "PERBAIKAN");
  const ekor = lanjut && lanjut.status === "BERJALAN" ? ` Tahap berikutnya: ${lanjut.judul}.` : "";
  await kabariCalon(admissionId, { kunci: peristiwa.kunci, judul: peristiwa.judul, isi: peristiwa.isi + ekor });
}
