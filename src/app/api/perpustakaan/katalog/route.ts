import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aturanPerpustakaan, tersediaPerBuku } from "@/lib/perpustakaan-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const ANGGOTA = ["ADMIN", "TAS", "TEACHER", "STUDENT"] as const;

/** KATALOG ANGGOTA (portal /perpustakaan) — semua buku + ketersediaan, plus status milik pengguna ini
 * (sedang dipinjam / sudah dipesan). Tidak memuat QR barcode (itu khusus petugas, berat dibuat per buku). */
export async function GET() {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole([...ANGGOTA]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [buku, dipinjam, pinjamanSaya, pesananSaya, aturan] = await Promise.all([
    prisma.book.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, author: true, publisher: true, category: true, location: true, coverUrl: true, fileUrl: true, stock: true, createdAt: true },
    }),
    tersediaPerBuku(),
    prisma.bookLoan.findMany({ where: { borrowerId: session.userId, status: "DIPINJAM" }, select: { bookId: true, dueDate: true } }),
    prisma.bookReservation.findMany({ where: { borrowerId: session.userId, status: { in: ["MENUNGGU", "TERSEDIA"] } }, select: { id: true, bookId: true, status: true } }),
    aturanPerpustakaan(),
  ]);
  const pinjam = new Map(pinjamanSaya.map(p => [p.bookId, p.dueDate]));
  const pesan = new Map(pesananSaya.map(p => [p.bookId, p]));
  return NextResponse.json({
    kategori: [...new Set(buku.map(b => b.category))].sort(),
    maksPesan: aturan.maksPesan,
    jumlahPesanan: pesananSaya.length,
    buku: buku.map(b => ({
      ...b,
      tersedia: Math.max(0, b.stock - (dipinjam.get(b.id) ?? 0)),
      sedangDipinjamSaya: pinjam.has(b.id) ? pinjam.get(b.id) : null,
      pesananSaya: pesan.get(b.id) ?? null,
    })),
  });
}

/** Pesan (reservasi) buku untuk diri sendiri. */
export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole([...ANGGOTA]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bookId } = (await req.json().catch(() => ({}))) as { bookId?: string };
  if (!bookId) return NextResponse.json({ error: "Pilih buku yang akan dipesan." }, { status: 400 });
  const [buku, aturan, aktif, sedangPinjam, sudahPesan, siswa] = await Promise.all([
    prisma.book.findUnique({ where: { id: bookId }, select: { id: true, title: true } }),
    aturanPerpustakaan(),
    prisma.bookReservation.count({ where: { borrowerId: session.userId, status: { in: ["MENUNGGU", "TERSEDIA"] } } }),
    prisma.bookLoan.findFirst({ where: { borrowerId: session.userId, bookId, status: "DIPINJAM" }, select: { id: true } }),
    prisma.bookReservation.findFirst({ where: { borrowerId: session.userId, bookId, status: { in: ["MENUNGGU", "TERSEDIA"] } }, select: { id: true } }),
    prisma.student.findFirst({ where: { userId: session.userId }, select: { studentStatus: true } }),
  ]);
  if (!buku) return NextResponse.json({ error: "Buku tidak ditemukan." }, { status: 404 });
  if (siswa?.studentStatus && siswa.studentStatus !== "AKTIF") return NextResponse.json({ error: "Hanya siswa aktif yang bisa memesan buku." }, { status: 409 });
  if (sedangPinjam) return NextResponse.json({ error: `Anda sedang meminjam "${buku.title}".` }, { status: 409 });
  if (sudahPesan) return NextResponse.json({ error: `"${buku.title}" sudah Anda pesan.` }, { status: 409 });
  if (aktif >= aturan.maksPesan) return NextResponse.json({ error: `Batas pesanan aktif ${aturan.maksPesan} buku. Batalkan salah satu atau ambil pesanan dulu.` }, { status: 409 });
  const r = await prisma.bookReservation.create({ data: { bookId, borrowerId: session.userId, notes: "Dipesan anggota lewat Portal Perpustakaan" } });
  return NextResponse.json({ ok: true, id: r.id }, { status: 201 });
}

/** Batalkan pesanan sendiri. */
export async function DELETE(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole([...ANGGOTA]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const r = await prisma.bookReservation.updateMany({
    where: { id: id ?? "", borrowerId: session.userId, status: { in: ["MENUNGGU", "TERSEDIA"] } },
    data: { status: "DIBATALKAN" },
  });
  if (!r.count) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
