import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { LABEL_STATUS } from "@/lib/spmb-status";
import { tandaFormulir } from "@/lib/spmb-formulir";

export const dynamic = "force-dynamic";

/** Cek status pendaftaran TANPA AKUN (keputusan user 1 Oktober 2026).
 *  Jalur utama: NOMOR PENDAFTARAN + TANGGAL LAHIR — nomor saja mudah ditebak orang lain.
 *  Jalur lama (nomor WA / email) tetap diterima supaya tautan & petunjuk yang sudah dibagikan
 *  tidak mati, tetapi keputusan diterima/tidak hanya muncul setelah panitia membuka hasil. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const nomor = sp.get("nomor")?.trim();
  const lahir = sp.get("lahir")?.trim();
  const q = sp.get("q")?.trim();

  const pakaiNomor = !!nomor && !!lahir;
  if (!pakaiNomor && (!q || q.length < 5)) {
    return Response.json({ error: "Masukkan nomor pendaftaran + tanggal lahir, atau nomor WA/email yang terdaftar." }, { status: 400 });
  }

  try {
    const where = pakaiNomor
      ? { nomor: nomor!.toUpperCase() }
      : { OR: [{ phone: { contains: q! } }, { email: { equals: q!.toLowerCase() } }] };

    const admission = await prisma.admission.findFirst({
      where,
      select: {
        fullName: true, birthDate: true, nomor: true, chosenMajor: true, status: true, notes: true,
        createdAt: true, skorAkhir: true, paymentVerified: true, daftarUlangConfirmedAt: true,
        gelombang: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!admission) return Response.json({ found: false });

    // Tanggal lahir dibandingkan di WIB — baris disimpan sebagai tengah malam waktu setempat.
    if (pakaiNomor) {
      const tersimpan = new Date(admission.birthDate.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
      if (tersimpan !== lahir) return Response.json({ found: false });
    }

    const s = await getSettings(["spmb.hasilDibuka", "spmb.tahapSeleksi"]);
    // Tanpa tahap seleksi, keputusan diterima tidak menunggu tombol Buka Hasil (spmb-tahapan.ts).
    const hasilDibuka = s["spmb.hasilDibuka"] === "1" || s["spmb.tahapSeleksi"] === "0";
    const keputusan = ["DITERIMA", "CADANGAN", "DITOLAK", "ACCEPTED", "REJECTED"].includes(admission.status);

    const parts = admission.fullName.trim().split(" ");
    const maskedName = parts
      .map((p, i) => (i === 0 ? p.slice(0, 2) + "*".repeat(Math.max(p.length - 2, 2)) : p[0] + "*".repeat(Math.max(p.length - 1, 1))))
      .join(" ");

    // Sebelum hasil dibuka, pendaftar hanya diberi tahu berkasnya sudah masuk/diperiksa.
    const status = keputusan && !hasilDibuka ? "VERIFIKASI" : admission.status;

    return Response.json({
      found: true,
      hasilDibuka,
      data: {
        maskedName,
        nama: pakaiNomor ? admission.fullName : maskedName,
        nomor: admission.nomor,
        gelombang: admission.gelombang?.nama ?? null,
        chosenMajor: admission.chosenMajor,
        status,
        statusLabel: LABEL_STATUS[status] ?? status,
        notes: keputusan && !hasilDibuka ? null : admission.notes,
        skorAkhir: hasilDibuka ? admission.skorAkhir : null,
        daftarUlang: hasilDibuka ? { dikonfirmasi: !!admission.daftarUlangConfirmedAt, lunas: admission.paymentVerified } : null,
        createdAt: admission.createdAt,
        // Tanda cetak HANYA diberikan pada jalur nomor + tanggal lahir — jalur WA/e-mail lebih
        // longgar (nomor WA bisa dipakai beberapa orang serumah), jadi tidak ikut diberi kunci cetak.
        tandaCetak: pakaiNomor && admission.nomor ? tandaFormulir(admission.nomor, lahir!) : null,
      },
    });
  } catch {
    return Response.json({ error: "Gagal mengambil data, coba lagi." }, { status: 500 });
  }
}
