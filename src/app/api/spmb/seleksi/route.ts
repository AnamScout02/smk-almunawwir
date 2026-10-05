import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb, hitungSkorSpmb } from "@/lib/spmb";
import { getSettings } from "@/lib/site-settings";
import { bacaKontenSpmb, nilaiPrestasi } from "@/lib/spmb-konten";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Seleksi SPMB: nilai per komponen → skor berbobot → peringkat per jurusan dibanding kuota.
 *  Peringkat dihitung DI SERVER supaya layar dan keputusan penerimaan memakai angka yang sama. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId") || undefined;
    const jurusan = req.nextUrl.searchParams.get("jurusan") || undefined;

    const [komponen, pendaftar, gelombang, setelan] = await Promise.all([
      prisma.komponenNilaiSpmb.findMany({ where: { aktif: true }, orderBy: [{ urutan: "asc" }] }),
      prisma.admission.findMany({
        where: { ...(gelombangId ? { gelombangId } : {}), ...(jurusan ? { chosenMajor: jurusan } : {}) },
        orderBy: [{ chosenMajor: "asc" }, { fullName: "asc" }],
        select: {
          id: true, nomor: true, fullName: true, chosenMajor: true, jalur: true, status: true,
          nisn: true, previousSchool: true, skorAkhir: true,
          nilaiSpmb: { select: { komponenId: true, nilai: true, lulus: true, catatan: true } },
        },
      }),
      prisma.gelombangSpmb.findMany({
        orderBy: { urutan: "asc" },
        include: { kuota: { include: { major: { select: { code: true, name: true } } } } },
      }),
      getSettings(["spmb.bobotPrestasi"]),
    ]);
    const bobotPrestasi = bacaKontenSpmb(setelan).bobotPrestasi;

    const dihitung = pendaftar.map(p => {
      const h = hitungSkorSpmb(komponen, p.nilaiSpmb);
      return { ...p, skor: h.skor, gugur: h.gugur, lengkap: h.lengkap, terisi: h.terisi, jumlahAngka: h.jumlahAngka };
    });

    // Peringkat per jurusan: yang gugur & yang belum dinilai tidak diberi peringkat.
    const perJurusan = new Map<string, typeof dihitung>();
    for (const p of dihitung) {
      const arr = perJurusan.get(p.chosenMajor) ?? [];
      arr.push(p); perJurusan.set(p.chosenMajor, arr);
    }
    const peringkat = new Map<string, number>();
    for (const arr of perJurusan.values()) {
      arr.filter(p => !p.gugur && p.skor !== null)
        .sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0))
        .forEach((p, i) => peringkat.set(p.id, i + 1));
    }

    return NextResponse.json({
      komponen, bobotPrestasi,
      gelombang: gelombang.map(g => ({
        id: g.id, nama: g.nama, urutan: g.urutan,
        kuota: g.kuota.map(k => ({ kode: k.major.code, nama: k.major.name, kuota: k.kuota })),
      })),
      pendaftar: dihitung.map(p => ({ ...p, peringkat: peringkat.get(p.id) ?? null })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Simpan nilai: { nilai: [{ admissionId, komponenId, nilai?, lulus?, catatan? }] }.
 *  Hanya yang BERUBAH dikirim klien; skorAkhir tiap pendaftar yang disentuh dihitung ulang sekali. */
export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json();
    const masuk = Array.isArray(b?.nilai) ? b.nilai : null;
    if (!masuk?.length) return NextResponse.json({ error: "Tidak ada nilai yang dikirim" }, { status: 400 });
    if (masuk.length > 2000) return NextResponse.json({ error: "Terlalu banyak nilai dalam satu kiriman" }, { status: 400 });

    const komponen = await prisma.komponenNilaiSpmb.findMany({ select: { id: true, jenis: true, bobot: true, nilaiMaks: true, aktif: true } });
    const bobotPrestasi = bacaKontenSpmb(await getSettings(["spmb.bobotPrestasi"])).bobotPrestasi;
    const petaKomponen = new Map(komponen.map(k => [k.id, k]));
    const tersentuh = new Set<string>();

    await prisma.$transaction(async tx => {
      for (const n of masuk) {
        const admissionId = String(n?.admissionId ?? "");
        const komponenId = String(n?.komponenId ?? "");
        const k = petaKomponen.get(komponenId);
        if (!admissionId || !k) continue;
        tersentuh.add(admissionId);

        const kosong = n?.nilai === null || n?.nilai === "" || n?.nilai === undefined;
        const lulus = k.jenis === "LULUS_TIDAK" ? (typeof n?.lulus === "boolean" ? n.lulus : null) : null;
        const catatan = String(n?.catatan ?? "").trim() || null;

        // PRESTASI: angkanya DIHITUNG SERVER dari tabel bobot — browser hanya mengirim tingkat &
        // peringkat sertifikatnya, jadi nilainya tidak bisa dikarang dari layar.
        let tingkat: string | null = null, peringkat: string | null = null;
        let nilai: number | null = null;
        if (k.jenis === "PRESTASI") {
          tingkat = String(n?.tingkat ?? "").toUpperCase().trim() || null;
          peringkat = String(n?.peringkat ?? "").trim() || null;
          nilai = tingkat && peringkat ? nilaiPrestasi(bobotPrestasi, tingkat, peringkat) : null;
        } else if (k.jenis === "ANGKA" && !kosong) {
          nilai = Math.max(0, Math.min(Number(n.nilai) || 0, k.nilaiMaks));
        }

        // Sel dikosongkan = baris nilainya dihapus, bukan disimpan sebagai 0 — nilai 0 berarti
        // "dinilai dan dapat nol", dan itu beda artinya dari "belum dinilai".
        if (nilai === null && lulus === null && !catatan) {
          await tx.nilaiSpmb.deleteMany({ where: { admissionId, komponenId } });
          continue;
        }
        await tx.nilaiSpmb.upsert({
          where: { admissionId_komponenId: { admissionId, komponenId } },
          update: { nilai, lulus, tingkat, peringkat, catatan, penilaiNama: session.name },
          create: { admissionId, komponenId, nilai, lulus, tingkat, peringkat, catatan, penilaiNama: session.name },
        });
      }

      const aktif = komponen.filter(k => k.aktif);
      for (const admissionId of tersentuh) {
        const semua = await tx.nilaiSpmb.findMany({ where: { admissionId }, select: { komponenId: true, nilai: true, lulus: true } });
        const h = hitungSkorSpmb(aktif, semua);
        await tx.admission.update({ where: { id: admissionId }, data: { skorAkhir: h.gugur ? 0 : h.skor } });
      }
    });

    await logActivity(session, {
      action: "UPDATE", entity: "NilaiSpmb",
      description: `Menyimpan nilai seleksi SPMB untuk ${tersentuh.size} pendaftar`,
    });
    return NextResponse.json({ ok: true, pendaftar: tersentuh.size });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan nilai" }, { status: 500 });
  }
}
