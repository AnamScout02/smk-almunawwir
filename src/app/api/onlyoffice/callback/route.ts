import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOnlyofficeToken, onlyofficeInternalUrl } from "@/lib/onlyoffice";
import { randomDocxKey, saveDocxToUploads } from "@/lib/onlyoffice-docx";

export const dynamic = "force-dynamic";

// Status dari ONLYOFFICE Document Server (lihat dokumentasi callbackUrl resmi):
// 0 = tidak ditemukan, 1 = sedang diedit, 2 = siap disimpan (semua user sudah tutup),
// 3 = gagal simpan, 4 = ditutup tanpa perubahan, 6 = force-save (masih diedit), 7 = gagal force-save.
const SAVEABLE_STATUS = [2, 6];

export async function POST(req: NextRequest) {
  try {
    /* Satu callback melayani Surat DAN Notulen — ONLYOFFICE hanya memanggil balik alamat yang
       kita berikan, jadi jenis dokumennya ditentukan dari parameter, bukan ditebak dari isi. */
    const suratId = req.nextUrl.searchParams.get("suratId");
    const notulenId = req.nextUrl.searchParams.get("notulenId");
    if (!suratId && !notulenId) return NextResponse.json({ error: 1 });

    const body = await req.json();

    // ONLYOFFICE mengirim JWT di header Authorization ATAU field `token` di body tergantung config —
    // verifikasi kalau ada; kalau JWT_ENABLED mati di server (mis. saat development) body.token kosong.
    const authHeader = req.headers.get("authorization");
    const token = body.token || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);
    if (token) {
      try {
        await verifyOnlyofficeToken(token);
      } catch {
        return NextResponse.json({ error: 1 });
      }
    }

    if (!SAVEABLE_STATUS.includes(body.status)) {
      return NextResponse.json({ error: 0 });
    }

    // ONLYOFFICE mengirim `url` memakai alamat PUBLIK Document Server (yang dipakai browser),
    // bukan alamat internal Docker — server ini sendiri TIDAK BISA menjangkau IP publiknya
    // sendiri (hairpin NAT), jadi fetch ke situ macet 10 detik lalu gagal, dan ONLYOFFICE
    // mengulang callback terus-menerus sampai server ini kehabisan kapasitas menangani
    // request lain (pernah kejadian nyata: web sekolah ikut down gara-gara ini). Ganti ke
    // alamat internal Docker Document Server supaya unduhan selalu lewat jaringan lokal.
    const publicOnlyofficeUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL;
    const downloadUrl = publicOnlyofficeUrl && body.url?.startsWith(publicOnlyofficeUrl)
      ? body.url.replace(publicOnlyofficeUrl, onlyofficeInternalUrl())
      : body.url;

    const fileRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(15000) });
    if (!fileRes.ok) return NextResponse.json({ error: 1 });
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    if (suratId) {
      const filename = `surat-${suratId}-${Date.now()}.docx`;
      const docxUrl = await saveDocxToUploads("surat-docx", filename, buffer);
      await prisma.surat.update({ where: { id: suratId }, data: { docxUrl, docxKey: randomDocxKey() } });
    } else if (notulenId) {
      const filename = `notulen-${notulenId}-${Date.now()}.docx`;
      const docxUrl = await saveDocxToUploads("notulen-docx", filename, buffer);
      await prisma.meetingMinutes.update({ where: { id: notulenId }, data: { docxUrl, docxKey: randomDocxKey() } });
    }

    return NextResponse.json({ error: 0 });
  } catch (e) {
    console.error("[onlyoffice callback]", e);
    return NextResponse.json({ error: 1 });
  }
}
