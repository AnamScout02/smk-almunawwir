import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/** Riwayat + status peminjaman buku milik user yang sedang login — dipakai halaman "Buku Saya"
 * di portal siswa, guru, maupun pegawai (TAS/Admin). Terbuka untuk SEMUA role karena siapapun
 * bisa jadi peminjam (`BookLoan.borrowerId` relasi langsung ke `User`, bukan `Student`/`Teacher`),
 * bukan cuma yang berjabatan Koordinator/Tim Perpustakaan. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
    const settings = await getSettings(["perpustakaan.dendaPerHari"]);
    const dendaPerHari = Number(settings["perpustakaan.dendaPerHari"] ?? 0);

    const loans = await prisma.bookLoan.findMany({
      where: { borrowerId: session.userId },
      include: { book: { select: { id: true, title: true, author: true, category: true, coverUrl: true } } },
      orderBy: { borrowDate: "desc" },
    });

    const now = new Date();
    const result = loans.map(l => {
      const isActive = l.status === "DIPINJAM";
      const endRef = isActive ? now : (l.returnDate ?? now);
      const daysLate = Math.max(0, Math.ceil((endRef.getTime() - l.dueDate.getTime()) / 86400000));
      const daysRemaining = isActive ? Math.ceil((l.dueDate.getTime() - now.getTime()) / 86400000) : null;
      return {
        id: l.id,
        book: l.book,
        borrowDate: l.borrowDate,
        dueDate: l.dueDate,
        returnDate: l.returnDate,
        status: l.status,
        finePaid: l.finePaid,
        isOverdue: isActive && daysLate > 0,
        daysLate,
        daysRemaining,
        fineAmount: daysLate * dendaPerHari,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
