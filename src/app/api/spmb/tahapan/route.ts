import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { aturanTahapan, denganBayar, jadwalDenganSesi, PILIH_TAHAPAN, ringkasBayar, setelanBayar } from "@/lib/spmb-tahapan-server";
import { tahapBerlaku, tahapSelesai, susunTahapan, type KodeTahap } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

/** Daftar tahapan seluruh calon untuk panitia — HANYA centang & ringkasan, tanpa isian sensitif. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId") || undefined;

    const [mentah, gelombang, aturan, setBayar, petaBayar] = await Promise.all([
      prisma.admission.findMany({
        where: gelombangId ? { gelombangId } : {},
        orderBy: { createdAt: "desc" },
        select: {
          ...PILIH_TAHAPAN, id: true, nomor: true, fullName: true, chosenMajor: true, phone: true, email: true,
          perbaikanAt: true, grupDiklikAt: true, grupBergabungAt: true, gelombangId: true, studentId: true, sesiId: true,
          sesi: { select: { tanggal: true, jamMulai: true, jamSelesai: true, tempat: true, catatan: true } },
        },
      }),
      prisma.gelombangSpmb.findMany({ orderBy: { urutan: "asc" }, select: { id: true, nama: true, tautanGrup: true, sesi: { orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }], select: { id: true, tanggal: true, jamMulai: true, jamSelesai: true, kuota: true, _count: { select: { pendaftar: true } } } } } }),
      aturanTahapan(),
      setelanBayar(),
      ringkasBayar(),
    ]);
    const baris = mentah.map(b => denganBayar(b, setBayar, petaBayar));

    const kode = tahapBerlaku(aturan);
    const rekapTahap = Object.fromEntries(kode.map(k => [k, 0])) as Record<KodeTahap, number>;
    const data = baris.map(b => {
      const { tahap, tuntas, ditolak } = susunTahapan(b, aturan, jadwalDenganSesi(null, b.sesi));
      for (const k of kode) if (tahapSelesai(k, b, aturan) !== false) rekapTahap[k]++;
      const berjalan = tahap.find(t => t.status !== "SELESAI") ?? null;
      return {
        id: b.id, nomor: b.nomor, nama: b.fullName, jurusan: b.chosenMajor, phone: b.phone, email: b.email,
        gelombangId: b.gelombangId, status: b.status, verifikasiStatus: b.verifikasiStatus,
        diperbaiki: b.verifikasiStatus === "BELUM" && !!b.perbaikanAt,
        centang: Object.fromEntries(tahap.map(t => [t.kode, t.status])),
        berjalan: berjalan ? { kode: berjalan.kode, judul: berjalan.judul, status: berjalan.status } : null,
        bayar: { sah: b.bayar.sah, menunggu: b.bayar.menunggu, sisa: b.bayar.sisa, tagihan: b.bayar.tagihan, lunas: b.bayar.lunas },
        sesiId: b.sesiId, sesi: b.sesi ? `${b.sesi.tanggal} ${b.sesi.jamMulai}` : null,
        tuntas, ditolak, grupDiklik: !!b.grupDiklikAt, grupBergabung: !!b.grupBergabungAt, sudahSiswa: !!b.studentId,
      };
    });

    // Perkiraan anggota grup WA per gelombang — sistem tidak bisa membaca isi grup WhatsApp, jadi
    // yang dihitung adalah calon yang menekan tombol grup & yang menyatakan sudah bergabung.
    const semua = gelombangId ? baris : await prisma.admission.findMany({ select: { gelombangId: true, grupDiklikAt: true, grupBergabungAt: true } });
    const perGelombang = gelombang.map(g => {
      const milik = semua.filter(x => x.gelombangId === g.id);
      return {
        id: g.id, nama: g.nama, adaGrup: !!g.tautanGrup, pendaftar: milik.length,
        klikGrup: milik.filter(x => x.grupDiklikAt).length, bergabung: milik.filter(x => x.grupBergabungAt).length,
        sesi: g.sesi.map(x => ({ id: x.id, label: `${x.tanggal} ${x.jamMulai}–${x.jamSelesai}`, kuota: x.kuota, terisi: x._count.pendaftar })),
      };
    });

    const bayarRingkas = {
      tagihanPerCalon: setBayar.total, biayaGelombang: gelombang.map(g => ({ nama: g.nama, biaya: setBayar.perGelombang?.[g.id] ?? 0 })), syarat: setBayar.syarat, uangMuka: setBayar.uangMuka,
      terkumpul: data.reduce((a, x) => a + x.bayar.sah, 0),
      menungguPeriksa: data.filter(x => x.bayar.menunggu > 0).length,
      lunas: data.filter(x => x.bayar.lunas).length,
    };
    return NextResponse.json({ data, kode, rekapTahap, perGelombang, aturan, bayarRingkas });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}
