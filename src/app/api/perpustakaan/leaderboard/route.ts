import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Papan Peringkat Perpustakaan — siapapun yang login boleh lihat (dipasang utk layar umum,
 * pola sama seperti Papan Peringkat Kedisiplinan Guru), tidak ada gating jabatan di sini.
 * "Paling Aktif": gabungan frekuensi kunjungan + peminjaman pada periode dipilih.
 * "Perlu Perhatian": peminjam dengan buku YANG SEDANG dipinjam & sudah lewat jatuh tempo
 * (selalu status TERKINI, tidak terikat filter periode — supaya selalu relevan). */
export async function GET(req: NextRequest) {
  try {
    await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);

    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get("period");
    const period = periodParam === "month" ? "month" : periodParam === "all" ? "all" : "week";
    const dateParam = searchParams.get("date");
    const refDate = dateParam ? new Date(dateParam) : new Date();

    let start: Date | undefined;
    let end: Date | undefined;
    let periodLabel = "Sepanjang Waktu";
    if (period === "week") {
      const day = refDate.getDay(); // 0 = Minggu
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start = new Date(refDate); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + diffToMonday);
      end = new Date(start); end.setDate(start.getDate() + 7);
      const endDisplay = new Date(end.getTime() - 86400000);
      periodLabel = `${start.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${endDisplay.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
    } else if (period === "month") {
      start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
      periodLabel = start.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }

    const [visitGroups, loanGroups, overdueLoans] = await Promise.all([
      prisma.libraryVisit.groupBy({ by: ["userId"], where: start && end ? { visitedAt: { gte: start, lt: end } } : {}, _count: { id: true } }),
      prisma.bookLoan.groupBy({ by: ["borrowerId"], where: start && end ? { borrowDate: { gte: start, lt: end } } : {}, _count: { id: true } }),
      prisma.bookLoan.findMany({ where: { status: "DIPINJAM", dueDate: { lt: new Date() } }, select: { borrowerId: true, dueDate: true } }),
    ]);

    const visitMap = new Map(visitGroups.map(v => [v.userId, v._count.id]));
    const loanMap = new Map(loanGroups.map(l => [l.borrowerId, l._count.id]));
    const overdueMap = new Map<string, { count: number; totalDaysLate: number }>();
    const now = new Date();
    for (const l of overdueLoans) {
      const days = Math.max(0, Math.ceil((now.getTime() - l.dueDate.getTime()) / 86400000));
      const cur = overdueMap.get(l.borrowerId) ?? { count: 0, totalDaysLate: 0 };
      overdueMap.set(l.borrowerId, { count: cur.count + 1, totalDaysLate: cur.totalDaysLate + days });
    }

    const allUserIds = new Set<string>([...visitMap.keys(), ...loanMap.keys(), ...overdueMap.keys()]);
    if (allUserIds.size === 0) {
      return NextResponse.json({ topAktif: [], perluPerhatian: [], periodLabel });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [...allUserIds] } },
      select: { id: true, name: true, role: true, student: { select: { class: { select: { name: true } } } } },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const topAktif = [...new Set([...visitMap.keys(), ...loanMap.keys()])]
      .map(id => {
        const u = userMap.get(id);
        const visitCount = visitMap.get(id) ?? 0;
        const loanCount = loanMap.get(id) ?? 0;
        return {
          userId: id, name: u?.name ?? "—", role: u?.role ?? "STUDENT", className: u?.student?.class?.name ?? null,
          visitCount, loanCount, score: visitCount + loanCount * 2,
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const perluPerhatian = [...overdueMap.entries()]
      .map(([id, agg]) => {
        const u = userMap.get(id);
        return { userId: id, name: u?.name ?? "—", role: u?.role ?? "STUDENT", className: u?.student?.class?.name ?? null, ...agg };
      })
      .sort((a, b) => b.totalDaysLate - a.totalDaysLate)
      .slice(0, 10);

    return NextResponse.json({ topAktif, perluPerhatian, periodLabel });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
