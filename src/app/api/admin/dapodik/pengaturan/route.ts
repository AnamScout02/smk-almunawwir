import { verifyDapodikAccess } from "@/lib/dapodik-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import {
  IP_SERVER_BAWAAN, KUNCI_ALAMAT_DAPODIK, KUNCI_IP_SERVER_DAPODIK, KUNCI_TOKEN_DAPODIK, enkripsiKunciDapodik, konfigurasiDapodik,
  periksaAlamatDapodik, periksaIpServer, periksaKunciDapodik,
} from "@/lib/dapodik";

export const dynamic = "force-dynamic";

/** UBAH ALAMAT DAPODIK, IP SERVER SITUS, & KUNCI WEB SERVICE — Administrator & Operator Sekolah (kunci ikut terkirim ke alamat
 * ini, jadi staf TU lain cukup melihat). Isian alamat/IP kosong = kembali ke bawaan server. Kunci: `kunci` terisi = ganti (disimpan terenkripsi),
 * `hapusKunci: true` = kembali ke kunci .env, selain itu tidak disentuh. Setiap perubahan dicatat di Log Aktivitas — nilai kunci
 * TIDAK PERNAH ikut dicatat atau dikirim balik. */
export async function PUT(req: Request) {
  const { session, bolehUbah } = await verifyDapodikAccess();
  if (!bolehUbah) return Response.json({ error: "Pengaturan koneksi Dapodik hanya bisa diubah Administrator atau Operator Sekolah." }, { status: 403 });
  const body = await req.json().catch(() => null) as { alamat?: unknown; ipServer?: unknown; kunci?: unknown; hapusKunci?: unknown } | null;
  if (!body || typeof body.alamat !== "string" || typeof body.ipServer !== "string") {
    return Response.json({ error: "Isian alamat dan IP server wajib dikirim." }, { status: 400 });
  }
  const lama = await konfigurasiDapodik();
  const alamat = periksaAlamatDapodik(body.alamat, lama.urlBawaan);
  if (!alamat.ok) return Response.json({ error: alamat.pesan, kolom: "alamat" }, { status: 400 });
  const ip = periksaIpServer(body.ipServer);
  if (!ip.ok) return Response.json({ error: ip.pesan, kolom: "ipServer" }, { status: 400 });
  const isiKunci = typeof body.kunci === "string" ? body.kunci.trim() : "";
  const kunci = isiKunci ? periksaKunciDapodik(isiKunci) : null;
  if (kunci && !kunci.ok) return Response.json({ error: kunci.pesan, kolom: "kunci" }, { status: 400 });
  const hapusKunci = body.hapusKunci === true && !isiKunci;
  // Alamat yang sama persis dengan bawaan .env tidak perlu disimpan sebagai isian manual.
  const nilaiAlamat = alamat.nilai === lama.urlBawaan ? "" : alamat.nilai;
  const nilaiIp = ip.nilai === IP_SERVER_BAWAAN ? "" : ip.nilai;

  const simpan = (key: string, value: string) => value
    ? prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    : prisma.siteSetting.deleteMany({ where: { key } });
  await prisma.$transaction([
    simpan(KUNCI_ALAMAT_DAPODIK, nilaiAlamat), simpan(KUNCI_IP_SERVER_DAPODIK, nilaiIp),
    ...(kunci?.ok ? [simpan(KUNCI_TOKEN_DAPODIK, enkripsiKunciDapodik(kunci.nilai))] : hapusKunci ? [simpan(KUNCI_TOKEN_DAPODIK, "")] : []),
  ]);

  const baru = await konfigurasiDapodik();
  const perubahan = [
    lama.url !== baru.url ? `alamat ${lama.url || "(kosong)"} → ${baru.url || "(kosong)"}${baru.alamatManual ? "" : " (bawaan)"}` : "",
    lama.ipServer !== baru.ipServer ? `IP server situs ${lama.ipServer} → ${baru.ipServer}${baru.ipManual ? "" : " (bawaan)"}` : "",
    kunci?.ok ? "kunci Web Service diganti" : hapusKunci && lama.kunciManual ? "kunci Web Service dikembalikan ke bawaan server" : "",
  ].filter(Boolean);
  if (perubahan.length) {
    await logActivity(session, {
      action: "UBAH_PENGATURAN_DAPODIK", entity: "Dapodik", entityId: "pengaturan",
      description: `Pengaturan koneksi Dapodik diubah: ${perubahan.join("; ")}`,
    }).catch(() => {});
  }
  return Response.json({
    url: baru.url, urlBawaan: baru.urlBawaan, alamatManual: baru.alamatManual,
    ipServer: baru.ipServer, ipManual: baru.ipManual, adaKunci: baru.adaKunci, kunciManual: baru.kunciManual,
    kunciRusak: baru.kunciRusak, adaKunciBawaan: baru.adaKunciBawaan, berubah: perubahan.length > 0,
    // Terisi bila alamat yang disimpan BUKAN jaringan lokal — halaman wajib menampilkannya,
    // karena kunci Web Service ikut terkirim ke alamat itu (lihat periksaAlamatDapodik).
    peringatan: "peringatan" in alamat ? alamat.peringatan : undefined,
  });
}
