import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { parseNomorUrut } from "@/lib/nomor-surat";
import { suratMeta } from "@/lib/tu-konstanta";

export const dynamic = "force-dynamic";

/** Satu baris buku agenda surat keluar, dari sumber mana pun. */
export interface BarisAgenda {
  id: string;
  /** "KETERANGAN" hanya untuk surat keterangan lama yang dibuat sebelum modulnya dilebur ke
   * Persuratan (13 September 2026) — tidak ada baris baru dengan sumber ini. */
  sumber: "SURAT" | "KETERANGAN" | "TUGAS";
  sumberLabel: string;
  nomor: string;
  urut: number;
  tanggal: string;
  pihak: string;
  perihal: string;
  /** Halaman untuk membuka/mencetak baris ini — beda per sumber. */
  hrefCetak: string;
  hrefEdit: string | null;
}

/** Buku agenda surat keluar GABUNGAN.
 *
 * Surat keluar sekolah ini dulu lahir dari tiga tempat: Persuratan (bebas), Surat Keterangan, dan
 * Surat Tugas/SPPD. Ketiganya sudah lama berbagi satu urutan nomor, tapi daftarnya dulu terpisah —
 * akibatnya buku agenda bolong: nomor 406 dan 407 terpakai tapi tidak kelihatan di mana pun.
 *
 * Sejak 13 September 2026 tinggal DUA sumber: Surat Keterangan tidak lagi punya jalur cetak
 * sendiri — permohonan yang disetujui langsung jadi baris `Surat` dari template Persuratan.
 * Baris bersumber "KETERANGAN" di bawah hanya sisa data lama sebelum peleburan itu.
 *
 * Formulir Surat Tugas SENGAJA tetap terpisah: SPPD punya butir 1-9 berformat baku yang tidak
 * mungkin dihasilkan dari editor bebas.
 *
 * Surat MASUK tidak lewat sini — sumbernya cuma satu (tabel Surat), dan alurnya beda (disposisi). */
export async function GET() {
  try {
    await verifyTasAccess();

    const [surat, keterangan, tugas] = await Promise.all([
      prisma.surat.findMany({
        where: { tipe: "KELUAR" },
        select: { id: true, nomor: true, tanggal: true, pihak: true, perihal: true },
      }),
      prisma.suratKeterangan.findMany({
        select: { id: true, nomorSurat: true, tanggal: true, namaSiswa: true, jenis: true, suratId: true },
      }),
      prisma.suratTugas.findMany({
        select: {
          id: true, nomor: true, tanggal: true, maksud: true,
          pegawai: { where: { peran: "PELAKSANA" }, select: { nama: true }, orderBy: { urutan: "asc" } },
        },
      }),
    ]);

    const baris: BarisAgenda[] = [
      ...surat.map(s => ({
        id: s.id, sumber: "SURAT" as const, sumberLabel: "Surat Keluar",
        nomor: s.nomor, urut: parseNomorUrut(s.nomor),
        tanggal: s.tanggal.toISOString(), pihak: s.pihak || "—", perihal: s.perihal || "(belum diisi)",
        hrefCetak: `/dashboard/admin/persuratan/${s.id}/cetak`,
        hrefEdit: `/dashboard/admin/persuratan/${s.id}/edit`,
      })),
      ...keterangan
        // Permohonan yang belum disetujui belum punya nomor — belum masuk buku agenda.
        // Yang sudah disetujui SETELAH 13 September 2026 juga tidak muncul dari sini: suratnya
        // sudah lahir sebagai baris `Surat` biasa (kolom `suratId` terisi), jadi menampilkannya
        // lagi dari tabel permohonan cuma bikin satu surat kelihatan dua kali.
        .filter(k => k.nomorSurat && !k.suratId)
        .map(k => ({
          id: k.id, sumber: "KETERANGAN" as const, sumberLabel: "Surat Keterangan",
          nomor: k.nomorSurat!, urut: parseNomorUrut(k.nomorSurat!),
          tanggal: k.tanggal.toISOString(), pihak: k.namaSiswa,
          perihal: suratMeta(k.jenis).judul,
          hrefCetak: `/dashboard/admin/surat-keterangan/${k.id}/cetak`,
          hrefEdit: null,
        })),
      ...tugas.map(t => ({
        id: t.id, sumber: "TUGAS" as const, sumberLabel: "Surat Tugas & SPPD",
        nomor: t.nomor, urut: parseNomorUrut(t.nomor),
        tanggal: t.tanggal.toISOString(),
        pihak: t.pegawai.map(p => p.nama).join(", ") || "—",
        perihal: t.maksud,
        hrefCetak: `/dashboard/admin/surat-tugas/${t.id}/cetak`,
        hrefEdit: "/dashboard/admin/surat-tugas",
      })),
    ].sort((a, b) => b.urut - a.urut || b.tanggal.localeCompare(a.tanggal));

    // Nomor yang dipakai lebih dari satu surat — ditandai supaya ketahuan sejak di daftar,
    // bukan baru saat dokumennya sudah telanjur dikirim.
    const hitung = new Map<string, number>();
    for (const b of baris) if (b.nomor) hitung.set(b.nomor, (hitung.get(b.nomor) ?? 0) + 1);
    const nomorKembar = [...hitung.entries()].filter(([, n]) => n > 1).map(([n]) => n);

    return Response.json({ baris, nomorKembar });
  } catch {
    return Response.json({ error: "Gagal memuat agenda surat" }, { status: 500 });
  }
}
