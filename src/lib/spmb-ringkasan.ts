/** RINGKASAN OTOMATIS PER CALON (9 Oktober 2026) — murni & netral.
 *
 *  Satu paragraf untuk panitia yang membuka jendela calon: sedang di tahap apa, giliran siapa, berkas
 *  apa yang kurang, sudah berapa hari diam, sudah membayar berapa. Disusun dengan ATURAN dari data yang
 *  sudah ada — bukan AI — jadi tidak pernah menyebut hal yang tidak ada di datanya. Kalimat yang datanya
 *  kosong tidak ditulis sama sekali (bukan diisi "tidak diketahui").
 *
 *  Asesmen & cek kesehatan hanya disebut SUDAH/BELUM, tidak pernah isinya (data sensitif, CLAUDE.md #129). */
import { rupiah, type InfoBayar, type KunciTertahan, type TahapCalon } from "@/lib/spmb-tahapan";

export type BahanRingkasan = {
  nama: string; nomor: string | null; jurusan: string; gelombang: string | null; perujuk: string | null;
  daftar: Date | string; kini?: Date;
  tahap: TahapCalon[]; tuntas: boolean; ditolak: boolean; status: string;
  verifikasiStatus: string;
  /** Berkas yang panitia minta diunggah ulang (label). */
  dimintaUlang: string[];
  perbaikanAt: Date | string | null;
  /** Berkas WAJIB yang belum ada (label). */
  berkasKurang: string[];
  tertahan: KunciTertahan | null;
  diamHari: number;
  bayar: InfoBayar; buktiMenunggu: number;
  sesi: string | null;
  adaHp: boolean; kabarTerakhir: Date | string | null;
  sudahSiswa: boolean;
};

const tgl = (d: Date | string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const daftar = (v: string[]) => (v.length <= 1 ? v.join("") : `${v.slice(0, -1).join(", ")} dan ${v[v.length - 1]}`);

const TUNGGU_CALON: Record<KunciTertahan, string> = {
  PERBAIKAN: "mengunggah ulang berkas yang diminta",
  SERAGAM: "memilih ukuran seragam",
  SESI: "memilih sesi kedatangan",
  PAKTA: "menandatangani surat pernyataan orang tua",
  DAFTAR_ULANG: "mengonfirmasi daftar ulang",
  BAYAR: "membayar sampai memenuhi syarat ikut MPLS",
};
const TUNGGU_PANITIA: Partial<Record<TahapCalon["kode"], string>> = {
  VERIFIKASI: "memeriksa berkas",
  ASESMEN: "mengisi hasil asesmen awal",
  PEMERIKSAAN: "mengisi hasil cek fisik & kesehatan",
  DITERIMA: "menetapkan atau membuka hasil seleksi",
  DAFTAR_ULANG: "menyelesaikan daftar ulang",
};

/** Kalimat-kalimat ringkasan, berurutan. Digabung dengan spasi untuk dijadikan satu paragraf. */
export function ringkasCalon(b: BahanRingkasan): string[] {
  const k: string[] = [];
  const selesai = b.tahap.filter(t => t.status === "SELESAI").length;
  const berjalan = b.tahap.find(t => t.status !== "SELESAI") ?? null;

  k.push(`${b.nama}${b.nomor ? ` (${b.nomor})` : ""} mendaftar ${tgl(b.daftar)}${b.gelombang ? ` di ${b.gelombang}` : ""}` +
    `${b.jurusan ? `, jurusan ${b.jurusan}` : ""}${b.perujuk ? `, lewat perujuk ${b.perujuk}` : ""}.`);

  if (b.sudahSiswa) k.push("Sudah dijadikan siswa.");
  else if (b.tuntas) k.push("Semua tahap selesai — resmi peserta MPLS.");
  else if (b.ditolak) k.push("Keputusan panitia: tidak diterima.");
  else if (berjalan) {
    k.push(`Sekarang di tahap ${berjalan.judul} (${selesai} dari ${b.tahap.length} tahap selesai).`);
    const apa = b.tertahan ? TUNGGU_CALON[b.tertahan] : TUNGGU_PANITIA[berjalan.kode];
    const diam = b.diamHari >= 1 ? ` Tidak ada kegiatan selama ${b.diamHari} hari.` : "";
    if (apa) k.push(`Menunggu ${b.tertahan ? "calon" : "panitia"} ${apa}.${diam}`);
    else if (diam) k.push(diam.trim());
  }

  if (b.verifikasiStatus === "PERBAIKAN") {
    k.push(b.dimintaUlang.length ? `Berkas yang diminta diunggah ulang: ${daftar(b.dimintaUlang)}.` : "Panitia meminta perbaikan berkas.");
  } else if (b.verifikasiStatus === "BELUM" && b.perbaikanAt) {
    k.push(`Calon sudah mengirim perbaikan berkas pada ${tgl(b.perbaikanAt)} — perlu diperiksa ulang.`);
  }
  if (b.berkasKurang.length) k.push(`Berkas wajib yang belum ada: ${daftar(b.berkasKurang)}.`);
  else if (b.verifikasiStatus === "TERVERIFIKASI") k.push("Berkas lengkap dan sudah diverifikasi.");
  else if (b.verifikasiStatus === "BELUM" && !b.perbaikanAt) k.push("Berkas wajib lengkap, belum diverifikasi.");

  if (!b.ditolak) {
    const y = b.bayar;
    const tunggu = b.buktiMenunggu > 0 ? ` ${b.buktiMenunggu} bukti bayar (${rupiah(y.menunggu)}) menunggu diperiksa.` : "";
    if (y.tagihan <= 0) { if (tunggu) k.push(tunggu.trim()); }
    else if (y.lunas) k.push(`Pembayaran lunas (${rupiah(y.sah)}).${tunggu}`);
    else {
      const syarat = y.syarat === "TIDAK" ? "" : y.cukup ? " Syarat ikut MPLS sudah terpenuhi." : ` Syarat ikut MPLS belum terpenuhi (minimal ${rupiah(y.wajib)}).`;
      k.push(`${y.sah > 0 ? `Sudah membayar ${rupiah(y.sah)} dari ${rupiah(y.tagihan)}, sisa ${rupiah(y.sisa)}` : `Belum membayar; tagihan ${rupiah(y.tagihan)}`}` +
        `${y.potongan > 0 ? ` (setelah potongan ${rupiah(y.potongan)})` : ""}.${syarat}${tunggu}`);
    }
  }

  if (b.sesi && !b.tuntas && !b.ditolak) k.push(`Sesi kedatangan: ${b.sesi}.`);

  if (!b.tuntas && !b.ditolak && !b.sudahSiswa) {
    k.push(`${b.adaHp ? "Menerima pemberitahuan di HP" : "Belum mengaktifkan pemberitahuan di HP — hubungi lewat WhatsApp"}` +
      `${b.kabarTerakhir ? `; terakhir dikabari ${tgl(b.kabarTerakhir)}` : ""}.`);
  }
  return k;
}
