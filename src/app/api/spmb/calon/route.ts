import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { aturanTahapan, calonDariTanda, daftarSesi, denganBayar, PILIH_TAHAPAN, ringkasBayar, setelanBayar, tahapanDari } from "@/lib/spmb-tahapan-server";
import { kunciPublikVapid, pushTersedia } from "@/lib/push-server";
import { BERKAS_BAKU, bacaMpls, bacaPakta, bacaSetelanSeragam, isiPakta, itemSeragamUntuk, paktaTerbuka, tahapTerbuka, type PilihanSeragam } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

/** HALAMAN TAHAPAN CALON (6 Oktober 2026) — calon tanpa akun, dikenali nomor + tanda (lihat calonDariTanda).
 *  Yang dikirim hanya CENTANG & hal yang memang milik calon (seragam, berkas yang perlu diperbaiki).
 *  Isian asesmen & cek kesehatan TIDAK PERNAH ikut (keputusan user: data sensitif). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = await calonDariTanda(sp.get("nomor"), sp.get("t"));
  if (!id) return Response.json({ error: "Tautan tidak sah. Buka lagi dengan nomor pendaftaran dan tanggal lahir." }, { status: 404 });

  const [mentah, aturan, s, syarat, setBayar, petaBayar, riwayat, kabar] = await Promise.all([
    prisma.admission.findUnique({
      where: { id },
      select: {
        ...PILIH_TAHAPAN, id: true, nomor: true, keteranganPotongan: true, fullName: true, chosenMajor: true, verifikasiDokumen: true, perbaikanAt: true,
        seragam: true, gender: true, grupDiklikAt: true, grupBergabungAt: true, sesi: true, paktaNama: true, paktaHubungan: true, guardianName: true,
        gelombang: { select: { nama: true, tautanGrup: true, jadwalTahap: true } },
      },
    }),
    aturanTahapan(),
    getSettings(["spmb.seragam", "spmb.mpls", "spmb.tautanGrup", "spmb.kontakWa", "spmb.kontakNama", "spmb.tahun", "school.name", "spmb.pakta"]),
    prisma.dokumenSyaratSpmb.findMany({ select: { id: true, nama: true } }),
    setelanBayar(),
    ringkasBayar([id]),
    prisma.pembayaranSpmb.findMany({
      where: { admissionId: id }, orderBy: { tanggal: "desc" },
      select: { id: true, jumlah: true, tanggal: true, metode: true, status: true, alasanTolak: true, createdAt: true },
    }),
    prisma.kabarSpmb.findMany({ where: { admissionId: id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, judul: true, isi: true, createdAt: true } }),
  ]);
  if (!mentah) return Response.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
  const a = denganBayar(mentah, setBayar, petaBayar);

  const { tahap, tuntas, ditolak } = tahapanDari(a, aturan, a.gelombang?.jadwalTahap, a.sesi);
  // Sesi kedatangan: dipilih saat tahap Asesmen terbuka, boleh diganti sampai asesmen dilakukan.
  const opsiSesi = a.gelombangId ? await daftarSesi(a.gelombangId) : [];
  const namaSyarat = new Map(syarat.map(x => [x.id, x.nama]));
  const perbaikan = a.verifikasiStatus === "PERBAIKAN"
    ? {
        pesan: a.verifikasiPesan,
        dokumen: a.verifikasiDokumen.map(k => ({
          kunci: k,
          label: k.startsWith("syarat:") ? namaSyarat.get(k.slice(7)) ?? "Dokumen syarat" : BERKAS_BAKU.find(b => b.kunci === k)?.label ?? k,
        })),
      }
    : null;

  return Response.json({
    nama: a.fullName, nomor: a.nomor, jurusan: a.chosenMajor, gelombang: a.gelombang?.nama ?? null,
    tahun: s["spmb.tahun"], sekolah: s["school.name"] || "SMK Al-Munawwir IIBS",
    tahap, tuntas, ditolak,
    menungguPeriksaUlang: a.verifikasiStatus === "BELUM" && !!a.perbaikanAt,
    perbaikan,
    sesi: {
      pilihan: opsiSesi, dipilih: a.sesi?.id ?? null,
      terbuka: tahapTerbuka("ASESMEN", a, aturan) && !a.asesmenAt,
    },
    kabar,
    // Kartu peserta tes bisa dicetak begitu berkas diverifikasi (sebelum datang ke sekolah).
    kartuPeserta: a.verifikasiStatus === "TERVERIFIKASI" && !ditolak,
    pakta: (() => {
      const p = bacaPakta(s["spmb.pakta"]);
      if (!p.aktif) return null;
      return {
        judul: p.judul, wajib: p.wajib, isi: isiPakta(p, s["school.name"] || "SMK Al-Munawwir IIBS"),
        terbuka: paktaTerbuka(a, aturan), walinya: a.guardianName ?? "",
        sudah: a.paktaAt ? { nama: a.paktaNama, hubungan: a.paktaHubungan, at: a.paktaAt } : null,
      };
    })(),
    push: { publicKey: kunciPublikVapid(), tersedia: pushTersedia() },
    // Tautan grup tampil TEPAT SETELAH DAFTAR (keputusan user) — gelombang dulu, cadangan tautan umum.
    grup: { tautan: a.gelombang?.tautanGrup || "", diklik: !!a.grupDiklikAt, bergabung: !!a.grupBergabungAt },
    seragam: {
      // Hanya item untuk jenis kelamin calon (Celana untuk putra, Rok untuk putri).
      setelan: (() => { const st = bacaSetelanSeragam(s["spmb.seragam"]); return { ...st, item: itemSeragamUntuk(st, a.gender) }; })(),
      isi: a.seragam ?? null,
      terbuka: tahapTerbuka("SERAGAM", a, aturan),
      // Ukuran boleh diubah calon sampai panitia menyelesaikan asesmen (pesanan mulai direkap).
      terkunci: !!a.asesmenAt,
    },
    mpls: tuntas ? bacaMpls(s["spmb.mpls"]) : null,
    // Kartu pembayaran — terlihat sejak mendaftar, boleh dicicil, boleh setelah MPLS (keputusan user 6 Okt 2026).
    bayar: { ...a.bayar, info: setBayar.info, keteranganPotongan: a.keteranganPotongan, riwayat, sudahKonfirmasi: !!a.daftarUlangConfirmedAt },
    kontak: { nama: s["spmb.kontakNama"], wa: s["spmb.kontakWa"] },
  });
}

const URL_UNGGAH = /^\/api\/uploads\/admissions\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;

/** Tindakan calon: pilih seragam, kirim perbaikan berkas, catat tombol grup WA. */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(`spmb-calon:${getClientIp(req)}`, 40, 10 * 60_000)) {
    return Response.json({ error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  const b = await req.json().catch(() => null);
  const id = await calonDariTanda(b?.nomor, b?.t);
  if (!id) return Response.json({ error: "Tautan tidak sah." }, { status: 404 });
  const aksi = String(b?.aksi ?? "");

  if (aksi === "langganan" || aksi === "henti-langganan") {
    const sub = b?.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
    const endpoint = String(aksi === "langganan" ? sub?.endpoint ?? "" : b?.endpoint ?? "");
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return Response.json({ error: "Langganan tidak sah" }, { status: 400 });
    if (aksi === "henti-langganan") {
      await prisma.langgananSpmb.deleteMany({ where: { admissionId: id, endpoint } });
      return Response.json({ ok: true });
    }
    const p256dh = String(sub?.keys?.p256dh ?? ""), auth = String(sub?.keys?.auth ?? "");
    if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) return Response.json({ error: "Langganan tidak sah" }, { status: 400 });
    if ((await prisma.langgananSpmb.count({ where: { admissionId: id } })) >= 5) {
      // Batas perangkat per calon — yang paling lama diganti.
      const lama = await prisma.langgananSpmb.findFirst({ where: { admissionId: id }, orderBy: { createdAt: "asc" } });
      if (lama) await prisma.langgananSpmb.delete({ where: { id: lama.id } });
    }
    await prisma.langgananSpmb.upsert({
      where: { admissionId_endpoint: { admissionId: id, endpoint } },
      update: { p256dh, auth }, create: { admissionId: id, endpoint, p256dh, auth },
    });
    return Response.json({ ok: true });
  }

  if (aksi === "grup-klik" || aksi === "grup-gabung") {
    // Hanya menandai SEKALI — angka di portal = jumlah calon, bukan jumlah klik.
    await prisma.admission.updateMany({
      where: { id, ...(aksi === "grup-klik" ? { grupDiklikAt: null } : { grupBergabungAt: null }) },
      data: aksi === "grup-klik" ? { grupDiklikAt: new Date() } : { grupBergabungAt: new Date(), grupDiklikAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  const [a, aturan] = await Promise.all([
    prisma.admission.findUnique({ where: { id }, select: { ...PILIH_TAHAPAN, verifikasiDokumen: true, sesiId: true, gender: true } }),
    aturanTahapan(),
  ]);
  if (!a) return Response.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });

  if (aksi === "bayar") {
    const jumlah = Math.round(Number(b?.jumlah) || 0);
    const bukti = typeof b?.bukti === "string" ? b.bukti.trim() : "";
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.tanggal ?? "")) ? new Date(`${b.tanggal}T12:00:00+07:00`) : new Date();
    if (jumlah < 1000 || jumlah > 200_000_000) return Response.json({ error: "Isi jumlah yang dibayar." }, { status: 400 });
    if (!bukti || !URL_UNGGAH.test(bukti)) return Response.json({ error: "Unggah foto bukti pembayaran." }, { status: 400 });
    if (["DITOLAK", "REJECTED"].includes(a.status)) return Response.json({ error: "Pendaftaran ini tidak diterima." }, { status: 409 });
    const menunggu = await prisma.pembayaranSpmb.count({ where: { admissionId: id, status: "MENUNGGU" } });
    if (menunggu >= 5) return Response.json({ error: "Masih ada 5 bukti yang belum diperiksa panitia. Tunggu dulu sebelum mengirim lagi." }, { status: 429 });
    await prisma.pembayaranSpmb.create({
      data: { admissionId: id, jumlah, tanggal: tgl, bukti, metode: "TRANSFER", catatan: String(b?.catatan ?? "").trim().slice(0, 300) || null },
    });
    return Response.json({ ok: true });
  }

  if (aksi === "sesi") {
    if (!tahapTerbuka("ASESMEN", a, aturan) || a.asesmenAt) return Response.json({ error: "Sesi dipilih setelah ukuran seragam dan sebelum asesmen dilakukan." }, { status: 409 });
    const sesiId = String(b?.sesiId ?? "");
    try {
      await prisma.$transaction(async tx => {
        const sesi = await tx.sesiSpmb.findFirst({ where: { id: sesiId, gelombangId: a.gelombangId ?? "" }, include: { _count: { select: { pendaftar: true } } } });
        if (!sesi) throw new Error("Sesi tidak ditemukan.");
        // Kuota diperiksa di dalam transaksi; calon yang sudah di sesi ini tidak dihitung dua kali.
        const terisi = sesi._count.pendaftar - (a.sesiId === sesi.id ? 1 : 0);
        if (terisi >= sesi.kuota) throw new Error("Sesi ini sudah penuh. Pilih sesi lain.");
        await tx.admission.update({ where: { id }, data: { sesiId: sesi.id } });
      }, { isolationLevel: "Serializable" });
    } catch (e) {
      const pesan = (e as Error).message;
      return Response.json({ error: /penuh|tidak ditemukan/.test(pesan) ? pesan : "Sesi sedang ramai dipilih, coba lagi." }, { status: 409 });
    }
    return Response.json({ ok: true });
  }

  if (aksi === "daftar-ulang") {
    if (!tahapTerbuka("DAFTAR_ULANG", a, aturan)) return Response.json({ error: "Daftar ulang dibuka setelah tahap sebelumnya selesai." }, { status: 409 });
    const pakta = bacaPakta((await getSettings(["spmb.pakta"]))["spmb.pakta"]);
    if (pakta.aktif && pakta.wajib && !a.paktaAt) return Response.json({ error: "Surat pernyataan orang tua belum ditandatangani. Tanda tangani dulu di kartu Surat Pernyataan." }, { status: 409 });
    await prisma.admission.updateMany({ where: { id, daftarUlangConfirmedAt: null }, data: { daftarUlangConfirmedAt: new Date() } });
    return Response.json({ ok: true });
  }

  if (aksi === "seragam") {
    if (!tahapTerbuka("SERAGAM", a, aturan)) return Response.json({ error: "Pemilihan seragam dibuka setelah berkas diverifikasi panitia." }, { status: 409 });
    if (a.asesmenAt) return Response.json({ error: "Ukuran seragam sudah dikunci panitia. Hubungi panitia untuk mengubahnya." }, { status: 409 });
    const setelan = bacaSetelanSeragam((await getSettings(["spmb.seragam"]))["spmb.seragam"]);
    const masuk = (Array.isArray(b?.pilihan) ? b.pilihan : []) as PilihanSeragam[];
    const pilihan: PilihanSeragam[] = [];
    for (const item of itemSeragamUntuk(setelan, a.gender)) {
      const p = masuk.find(x => x?.item === item.nama);
      if (!p || !item.ukuran.some(u => u.label === p.ukuran)) {
        return Response.json({ error: `Pilih ukuran ${item.nama}.` }, { status: 400 });
      }
      pilihan.push({ item: item.nama, ukuran: p.ukuran });
    }
    await prisma.admission.update({
      where: { id },
      data: { seragam: { pilihan, catatan: String(b?.catatan ?? "").trim().slice(0, 300) }, seragamAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  if (aksi === "perbaikan") {
    if (a.verifikasiStatus !== "PERBAIKAN") return Response.json({ error: "Tidak ada berkas yang perlu diperbaiki." }, { status: 409 });
    const berkas = (b?.berkas && typeof b.berkas === "object" ? b.berkas : {}) as Record<string, unknown>;
    const data: Record<string, string> = {};
    const syarat: { syaratId: string; url: string }[] = [];
    for (const kunci of a.verifikasiDokumen) {
      const url = typeof berkas[kunci] === "string" ? (berkas[kunci] as string).trim() : "";
      if (!url) continue;
      if (!URL_UNGGAH.test(url)) return Response.json({ error: "Berkas tidak sah, unggah ulang." }, { status: 400 });
      if (kunci.startsWith("syarat:")) syarat.push({ syaratId: kunci.slice(7), url });
      else { const baku = BERKAS_BAKU.find(x => x.kunci === kunci); if (baku) data[baku.kolom] = url; }
    }
    const jumlah = Object.keys(data).length + syarat.length;
    if (a.verifikasiDokumen.length && jumlah < a.verifikasiDokumen.length) {
      return Response.json({ error: "Unggah semua berkas yang diminta panitia." }, { status: 400 });
    }
    await prisma.$transaction(async tx => {
      for (const s of syarat) {
        const ada = await tx.dokumenSyaratSpmb.findUnique({ where: { id: s.syaratId }, select: { id: true } });
        if (!ada) continue;
        await tx.berkasSpmb.upsert({
          where: { admissionId_syaratId: { admissionId: id, syaratId: s.syaratId } },
          update: { berkas: s.url, diverifikasi: false }, create: { admissionId: id, syaratId: s.syaratId, berkas: s.url },
        });
      }
      // Kembali ke antrean periksa panitia — pesan lama disimpan sebagai riwayat.
      await tx.admission.update({
        where: { id },
        data: { ...data, verifikasiStatus: "BELUM", verifikasiDokumen: [], perbaikanAt: new Date() },
      });
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Tindakan tidak dikenal" }, { status: 400 });
}
