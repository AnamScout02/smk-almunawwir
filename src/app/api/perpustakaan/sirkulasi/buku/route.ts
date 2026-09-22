import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { anggotaDariUserId, aturanPerpustakaan, hitungDenda, jatuhTempoBawaan, ringkasanAnggota } from "@/lib/perpustakaan-server";
import { kirimLatar } from "@/lib/push-server";
import { beritahuReservasiSiap } from "@/lib/notifikasi-perpustakaan";

export const dynamic = "force-dynamic";

/** MEJA SIRKULASI — langkah 2: pindai barcode buku untuk anggota yang sedang dilayani.
 *   - Anggota sedang meminjam buku itu → DIKEMBALIKAN (denda dihitung), reservasi antrean pertama → TERSEDIA.
 *   - Belum meminjam → PINJAM, dengan pemeriksaan: siswa aktif, eksemplar tersedia (tidak mengambil jatah
 *     reservasi orang lain yang sudah TERSEDIA), batas pinjaman aktif, dan buku terlambat (bisa dilewati `paksa`).
 * `aksi` "PINJAM"/"KEMBALI" memaksa arah; bawaan "OTOMATIS". */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);
    const b = (await req.json().catch(() => ({}))) as { kode?: string; anggotaId?: string; aksi?: string; jatuhTempo?: string; paksa?: boolean };
    const kode = (b.kode ?? "").trim();
    if (!kode || !b.anggotaId) return NextResponse.json({ error: "Pindai buku setelah memilih anggota." }, { status: 400 });

    const [anggota, buku, aturan] = await Promise.all([
      anggotaDariUserId(b.anggotaId),
      prisma.book.findFirst({ where: { OR: [{ barcode: kode }, { id: kode }] }, select: { id: true, title: true, author: true, stock: true, barcode: true, coverUrl: true } }),
      aturanPerpustakaan(),
    ]);
    if (!anggota) return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
    if (!buku) return NextResponse.json({ error: `Barcode "${kode}" bukan buku perpustakaan.` }, { status: 404 });

    const pinjamanSama = await prisma.bookLoan.findFirst({ where: { bookId: buku.id, borrowerId: anggota.id, status: "DIPINJAM" } });

    if (pinjamanSama && b.aksi !== "PINJAM") {
      const kini = new Date();
      await prisma.bookLoan.update({ where: { id: pinjamanSama.id }, data: { status: "DIKEMBALIKAN", returnDate: kini } });
      const d = hitungDenda(pinjamanSama.dueDate, kini, aturan.dendaPerHari);
      // Antrean reservasi: yang paling awal memesan diberi tahu bukunya siap diambil.
      const antre = await prisma.bookReservation.findFirst({ where: { bookId: buku.id, status: "MENUNGGU" }, orderBy: { reservedDate: "asc" } });
      if (antre) {
        await prisma.bookReservation.update({ where: { id: antre.id }, data: { status: "TERSEDIA" } });
        kirimLatar(() => beritahuReservasiSiap(antre.id));
      }
      return NextResponse.json({ hasil: "KEMBALI", buku, hariTerlambat: d.hariTerlambat, denda: d.denda, reservasiDisiapkan: !!antre, ...(await ringkasanAnggota(anggota.id)) });
    }
    if (b.aksi === "KEMBALI") return NextResponse.json({ error: `${anggota.nama} tidak sedang meminjam "${buku.title}".` }, { status: 409 });
    if (pinjamanSama) return NextResponse.json({ error: `${anggota.nama} masih meminjam "${buku.title}".` }, { status: 409 });

    if (!anggota.aktif) return NextResponse.json({ error: `${anggota.nama} bukan siswa aktif.` }, { status: 409 });
    const [dipinjam, aktifAnggota, terlambat, reservasiSiapLain, reservasiSaya] = await Promise.all([
      prisma.bookLoan.count({ where: { bookId: buku.id, status: "DIPINJAM" } }),
      prisma.bookLoan.count({ where: { borrowerId: anggota.id, status: "DIPINJAM" } }),
      prisma.bookLoan.count({ where: { borrowerId: anggota.id, status: "DIPINJAM", dueDate: { lt: new Date() } } }),
      prisma.bookReservation.count({ where: { bookId: buku.id, status: "TERSEDIA", borrowerId: { not: anggota.id } } }),
      prisma.bookReservation.findFirst({ where: { bookId: buku.id, borrowerId: anggota.id, status: { in: ["MENUNGGU", "TERSEDIA"] } } }),
    ]);
    if (buku.stock - dipinjam - reservasiSiapLain <= 0) {
      return NextResponse.json({ error: reservasiSiapLain ? `Semua eksemplar "${buku.title}" sedang dipinjam atau disiapkan untuk pemesan lain.` : `Semua eksemplar "${buku.title}" sedang dipinjam.` }, { status: 409 });
    }
    if (aktifAnggota >= aturan.maksPinjam) return NextResponse.json({ error: `${anggota.nama} sudah meminjam ${aktifAnggota} buku (batas ${aturan.maksPinjam}).` }, { status: 409 });
    if (terlambat && !b.paksa) return NextResponse.json({ error: `${anggota.nama} masih punya ${terlambat} buku terlambat. Kembalikan dulu, atau pinjamkan tetap dengan persetujuan petugas.`, bisaPaksa: true }, { status: 409 });

    const jatuhTempo = b.jatuhTempo && !Number.isNaN(Date.parse(b.jatuhTempo)) ? new Date(b.jatuhTempo) : jatuhTempoBawaan(aturan.masaHari);
    const pinjaman = await prisma.bookLoan.create({
      data: { bookId: buku.id, borrowerId: anggota.id, dueDate: jatuhTempo, notes: terlambat ? `Dipinjamkan walau ada ${terlambat} buku terlambat (oleh ${session.name})` : null },
    });
    if (reservasiSaya) await prisma.bookReservation.update({ where: { id: reservasiSaya.id }, data: { status: "SELESAI" } });
    return NextResponse.json({ hasil: "PINJAM", buku, jatuhTempo: pinjaman.dueDate, reservasiSelesai: !!reservasiSaya, ...(await ringkasanAnggota(anggota.id)) }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    console.error("[perpustakaan sirkulasi buku]", e);
    return NextResponse.json({ error: "Gagal memproses buku." }, { status: 500 });
  }
}
