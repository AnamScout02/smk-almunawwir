import "server-only";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { ttdDariNama } from "@/lib/ttd";
import { ambilFormulir } from "@/lib/spmb-formulir";
import { jadwalDenganSesi, setelanBayar } from "@/lib/spmb-tahapan-server";
import { bacaPakta, hitungBayar } from "@/lib/spmb-tahapan";

/** DOKUMEN CETAK CALON SPMB (7 Oktober 2026) — pakta orang tua, kuitansi cicilan, kartu peserta tes.
 *  Masing-masing dicetak dari DUA pintu (calon tanpa akun lewat nomor + tanda, dan panitia), memakai SATU
 *  pengambil data & SATU lembar cetak supaya isinya tidak pernah berbeda. QR keaslian mengikuti pola #49:
 *  token acak dibuat SEKALI lewat `updateMany where token = null`, halaman verifikasi hanya menampilkan
 *  identitas dokumen. */

const tokenBaru = () => randomBytes(18).toString("base64url");

/* ───────────────────────────── Pakta / surat pernyataan ───────────────────────────── */

/** TTD orang tua = data pribadi → folder RAHASIA (diblokir proxy, pola #44/#50). Dokumen cetak menyisipkannya
 *  sebagai data URL dari server, jadi tidak pernah ada alamat gambar yang bisa dibagikan. */
export const FOLDER_PAKTA = join(process.cwd(), "public", "uploads", "rahasia", "spmb-pakta");
const aman = (b: string) => b.replace(/[^A-Za-z0-9.-]/g, "");

export async function simpanTtdPakta(admissionId: string, png: Buffer): Promise<string> {
  const berkas = `${admissionId.replace(/[^A-Za-z0-9]/g, "")}-${Date.now()}-${randomBytes(6).toString("hex")}.png`;
  await mkdir(FOLDER_PAKTA, { recursive: true });
  await writeFile(join(FOLDER_PAKTA, berkas), png);
  return berkas;
}

export async function hapusTtdPakta(berkas: string | null | undefined) {
  if (berkas) await unlink(join(FOLDER_PAKTA, aman(berkas))).catch(() => {});
}

async function dataUrlPakta(berkas: string | null): Promise<string | null> {
  if (!berkas) return null;
  const isi = await readFile(join(FOLDER_PAKTA, aman(berkas))).catch(() => null);
  return isi ? `data:image/png;base64,${isi.toString("base64")}` : null;
}

async function pastikanTokenPakta(id: string, sekarang: string | null): Promise<string> {
  if (sekarang) return sekarang;
  const t = tokenBaru();
  const n = await prisma.admission.updateMany({ where: { id, paktaToken: null }, data: { paktaToken: t } });
  if (n.count) return t;
  return (await prisma.admission.findUnique({ where: { id }, select: { paktaToken: true } }))?.paktaToken ?? t;
}

/** Pakta satu calon untuk dicetak. Belum ditandatangani = lembar kosong untuk ditandatangani tangan (tanpa QR). */
export async function ambilPakta(where: { id: string } | { nomor: string }) {
  const a = await prisma.admission.findUnique({
    where: where as { id: string },
    select: {
      id: true, nomor: true, fullName: true, birthPlace: true, birthDate: true, chosenMajor: true, address: true,
      guardianName: true, phone: true, paktaTtd: true, paktaNama: true, paktaHubungan: true, paktaAt: true,
      paktaTeks: true, paktaToken: true, gelombang: { select: { nama: true } },
    },
  }).catch(() => null);
  if (!a) return null;
  const s = await getSettings(["spmb.pakta", "school.name"]);
  const p = bacaPakta(s["spmb.pakta"]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const ditandatangani = !!a.paktaAt;
  const token = ditandatangani ? await pastikanTokenPakta(a.id, a.paktaToken) : null;
  return {
    ...a,
    judul: p.judul,
    // Yang sudah ditandatangani dicetak dari SALINAN-nya, bukan teks pengaturan terkini.
    teks: a.paktaTeks || p.isi.replace(/\{sekolah\}/g, sekolah),
    ttd: await dataUrlPakta(a.paktaTtd),
    qr: token ? await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/pakta-spmb/${token}`).catch(() => "") : "",
  };
}
export type DataPakta = NonNullable<Awaited<ReturnType<typeof ambilPakta>>>;

/* ───────────────────────────── Kuitansi pembayaran ───────────────────────────── */

const tahunWib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).getUTCFullYear();

/** Nomor kuitansi berurut per tahun: KW-SPMB-2026-0001. Kolomnya unik — tabrakan dua cetakan bersamaan
 *  diulang dengan nomor berikutnya, jadi tidak pernah ada dua kuitansi bernomor sama. */
async function nomorKuitansi(pembayaranId: string, tanggal: Date): Promise<string> {
  const awalan = `KW-SPMB-${tahunWib(tanggal)}-`;
  for (let coba = 0; coba < 20; coba++) {
    const jumlah = await prisma.pembayaranSpmb.count({ where: { kuitansiNo: { startsWith: awalan } } });
    const no = `${awalan}${String(jumlah + 1 + coba).padStart(4, "0")}`;
    try {
      const n = await prisma.pembayaranSpmb.updateMany({ where: { id: pembayaranId, kuitansiNo: null }, data: { kuitansiNo: no } });
      if (n.count) return no;
      const ada = await prisma.pembayaranSpmb.findUnique({ where: { id: pembayaranId }, select: { kuitansiNo: true } });
      if (ada?.kuitansiNo) return ada.kuitansiNo;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("Gagal membuat nomor kuitansi");
}

/** Kuitansi SATU cicilan yang sudah SAH. `admissionId` diisi dari pintu calon supaya calon hanya bisa mencetak
 *  kuitansinya sendiri. Memuat ringkasan tagihan sesudah cicilan ini (cicilan ke-n, total sah, sisa). */
export async function ambilKuitansi(pembayaranId: string, admissionId?: string) {
  const p = await prisma.pembayaranSpmb.findFirst({
    where: { id: pembayaranId, status: "SAH", ...(admissionId ? { admissionId } : {}) },
    include: {
      admission: {
        select: {
          id: true, nomor: true, fullName: true, guardianName: true, chosenMajor: true, potonganBiaya: true,
          keteranganPotongan: true, gelombangId: true, gelombang: { select: { nama: true } },
        },
      },
    },
  }).catch(() => null);
  if (!p) return null;
  const tanggalSah = p.disahkanAt ?? p.tanggal;
  const no = p.kuitansiNo ?? await nomorKuitansi(p.id, tanggalSah);
  let token = p.kuitansiToken;
  if (!token) {
    const t = tokenBaru();
    const n = await prisma.pembayaranSpmb.updateMany({ where: { id: p.id, kuitansiToken: null }, data: { kuitansiToken: t } });
    token = n.count ? t : (await prisma.pembayaranSpmb.findUnique({ where: { id: p.id }, select: { kuitansiToken: true } }))?.kuitansiToken ?? t;
  }
  // Urutan cicilan & saldo dihitung dari pembayaran SAH calon itu, berurut tanggal bayar.
  const sahSemua = await prisma.pembayaranSpmb.findMany({
    where: { admissionId: p.admissionId, status: "SAH" }, orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }], select: { id: true, jumlah: true },
  });
  const ke = sahSemua.findIndex(x => x.id === p.id) + 1;
  const sampaiIni = sahSemua.slice(0, ke).reduce((a, x) => a + x.jumlah, 0);
  const bayar = hitungBayar(await setelanBayar(), p.admission.potonganBiaya, sampaiIni, 0, p.admission.gelombangId);
  return {
    id: p.id, no, jumlah: p.jumlah, tanggal: p.tanggal, tanggalSah, metode: p.metode, catatan: p.catatan,
    penerima: p.disahkanOleh, ttdPenerima: await ttdDariNama(p.disahkanOleh).catch(() => undefined),
    calon: p.admission, cicilanKe: ke, tagihan: bayar.tagihan, sampaiIni, sisa: bayar.sisa, lunas: bayar.lunas,
    qr: await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/kuitansi-spmb/${token}`).catch(() => ""),
  };
}
export type DataKuitansi = NonNullable<Awaited<ReturnType<typeof ambilKuitansi>>>;

/* ───────────────────────────── Kartu peserta tes ───────────────────────────── */

/** Kartu peserta untuk hari tes (asesmen & cek kesehatan). QR = QR keaslian formulir (token sama), jadi panitia
 *  bisa memindainya di meja untuk memastikan calon & nomornya. Hanya untuk calon yang berkasnya TERVERIFIKASI. */
export async function ambilKartuPeserta(where: { id: string } | { nomor: string }) {
  const f = await ambilFormulir(where);
  if (!f) return null;
  const x = await prisma.admission.findUnique({
    where: { id: f.id },
    select: { verifikasiStatus: true, sesi: true, gelombang: { select: { jadwalTahap: true } } },
  });
  if (!x) return null;
  const jadwal = jadwalDenganSesi(x.gelombang?.jadwalTahap, x.sesi);
  return {
    id: f.id, nomor: f.nomor, nama: f.fullName, gender: f.gender, jurusan: f.chosenMajor, sekolahAsal: f.previousSchool,
    gelombang: f.gelombang?.nama ?? null, foto: f.fotoUrl, qr: f.qr, terverifikasi: x.verifikasiStatus === "TERVERIFIKASI",
    sesi: x.sesi ? { tanggal: x.sesi.tanggal, jamMulai: x.sesi.jamMulai, jamSelesai: x.sesi.jamSelesai, tempat: x.sesi.tempat } : null,
    asesmen: jadwal.ASESMEN ?? null, pemeriksaan: jadwal.PEMERIKSAAN ?? null,
  };
}
export type DataKartuPeserta = NonNullable<Awaited<ReturnType<typeof ambilKartuPeserta>>>;
