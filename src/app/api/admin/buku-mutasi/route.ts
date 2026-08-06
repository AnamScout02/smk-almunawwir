import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

interface StructureRow { role: string; name: string; highlight?: boolean }

async function getPrincipalName(): Promise<string> {
  const s = await getSettings(["school.structure"]);
  try {
    const parsed = JSON.parse(s["school.structure"] ?? "[]") as StructureRow[];
    return parsed.find(r => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const bulan = searchParams.get("bulan") ?? String(now.getMonth() + 1);
    const tipe = searchParams.get("tipe");
    let tahunPelajaran = searchParams.get("tahunPelajaran");

    if (!tahunPelajaran) {
      const active = await prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } });
      tahunPelajaran = active?.name ?? `${now.getFullYear()}/${now.getFullYear() + 1}`;
    }

    // Buku Mutasi mengikuti Tahun Pelajaran (Juli-Juni), bukan tahun kalender —
    // "2026/2027" berarti Juli-Des masuk kalender 2026, Jan-Jun masuk kalender 2027.
    const startYear = parseInt(tahunPelajaran.split("/")[0]) || now.getFullYear();
    const m = parseInt(bulan);
    const y = m >= 7 ? startYear : startYear + 1;
    const rangeStart = new Date(y, m - 1, 1);
    const rangeEnd = new Date(y, m, 0, 23, 59, 59);

    // Buku Mutasi diambil dari seluruh siswa (bukan hanya yang dibuat/keluar di bulan ini) —
    // karena indikator MASUK (bukuIndukData.pindahanDari) & tanggal surat masuk (diterimaDate)
    // tersimpan di field JSON yang tidak bisa difilter langsung di level query Prisma/DB.
    const [allStudents, principalName, activeStudents] = await Promise.all([
      prisma.student.findMany({
        include: {
          user: { select: { name: true, email: true, createdAt: true } },
          class: { select: { name: true, grade: true } },
          major: { select: { name: true, code: true } },
        },
        orderBy: { user: { createdAt: "asc" } },
      }),
      getPrincipalName(),
      prisma.student.findMany({
        where: { studentStatus: "AKTIF" },
        select: { gender: true, class: { select: { grade: true } } },
      }),
    ]);

    const masuk = allStudents
      .filter(s => {
        const b = (s.bukuIndukData as Record<string, string> | null) ?? {};
        // Hanya siswa PINDAHAN (Section D "Pindahan Dari" terisi) yang dihitung mutasi masuk —
        // siswa baru PPDB reguler tidak dianggap mutasi walau akunnya dibuat di bulan ini.
        if (!b.pindahanDari) return false;
        const dateSrc = b.diterimaDate || s.user.createdAt;
        const d = new Date(dateSrc);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      })
      .map(s => {
        const b = (s.bukuIndukData as Record<string, string> | null) ?? {};
        return {
          id: s.id,
          tipe: "MASUK" as const,
          tanggal: b.diterimaDate || s.user.createdAt,
          nis: s.nis,
          nama: s.user.name,
          kelas: s.class?.name ?? "-",
          jurusan: s.major.code,
          asal: b.pindahanDari,
          asalSekolah: s.previousSchool ?? "-",
          asalNis: b.asalNis ?? "-",
          asalAlamat: b.prevSchoolAddress ?? "-",
          kelasAsal: b.kelasAsal ?? "-",
          suratTanggal: b.diterimaDate ?? s.user.createdAt,
          suratNomor: b.masukSuratNo ?? "-",
          keterangan: s.studentNotes ?? "",
        };
      });

    const keluar = allStudents
      .filter(s => {
        if (!["PINDAH", "KELUAR", "LULUS"].includes(s.studentStatus ?? "")) return false;
        if (!s.exitDate) return false;
        const d = new Date(s.exitDate);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      })
      .map(s => {
        const b = (s.bukuIndukData as Record<string, string> | null) ?? {};
        return {
          id: s.id,
          tipe: s.studentStatus as string,
          tanggal: s.exitDate ?? s.user.createdAt,
          nis: s.nis,
          nama: s.user.name,
          kelas: s.class?.name ?? "-",
          jurusan: s.major.code,
          tujuan: b.transferTo ?? "-",
          alasan: b.alasanPindah ?? s.studentNotes ?? "-",
          suratTanggal: b.pindahDate ?? s.exitDate,
          suratNomor: b.suratNo ?? "-",
        };
      });

    const rekapByGrade: Record<number, { L: number; P: number }> = { 10: { L: 0, P: 0 }, 11: { L: 0, P: 0 }, 12: { L: 0, P: 0 } };
    for (const s of activeStudents) {
      const grade = s.class?.grade;
      if (!grade || !rekapByGrade[grade]) continue;
      if (s.gender === "L") rekapByGrade[grade].L++;
      else if (s.gender === "P") rekapByGrade[grade].P++;
    }
    const rekap = [10, 11, 12].map(g => ({
      grade: g,
      label: g === 10 ? "X" : g === 11 ? "XI" : "XII",
      L: rekapByGrade[g].L, P: rekapByGrade[g].P, jumlah: rekapByGrade[g].L + rekapByGrade[g].P,
    }));
    const totalAktif = activeStudents.length;

    // Jumlah siswa di akhir bulan sebelumnya (= awal bulan ini): siswa yang sudah diterima
    // sebelum bulan ini dan belum keluar sebelum bulan ini — dipakai sebagai basis persentase
    // "Jumlah Siswa yang diterima/keluar" di Catatan, bukan total siswa aktif saat ini.
    const totalAwalBulan = allStudents.filter(s => {
      const b = (s.bukuIndukData as Record<string, string> | null) ?? {};
      const enroll = new Date(b.diterimaDate || s.user.createdAt);
      if (enroll >= rangeStart) return false;
      if (s.exitDate && new Date(s.exitDate) < rangeStart) return false;
      return true;
    }).length;

    const result = {
      masuk: tipe === "KELUAR" ? [] : masuk,
      keluar: tipe === "MASUK" ? [] : keluar,
      principalName,
      rekap,
      totalAktif,
      totalAwalBulan,
      tahun: y,
      tahunPelajaran,
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ masuk: [], keluar: [], principalName: "", rekap: [], totalAktif: 0, tahun: new Date().getFullYear(), tahunPelajaran: "", error: "Gagal mengambil data mutasi" }, { status: 500 });
  }
}
