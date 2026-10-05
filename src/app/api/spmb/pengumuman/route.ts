import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb, hitungSkorSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Pratinjau keputusan: peringkat per jurusan dibanding kuota gelombang. TIDAK mengubah apa pun. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId");
    if (!gelombangId) return NextResponse.json({ error: "Pilih gelombang dulu" }, { status: 400 });
    const cadangan = Math.max(0, Math.min(Number(req.nextUrl.searchParams.get("cadangan")) || 0, 200));
    return NextResponse.json(await susunKeputusan(gelombangId, cadangan));
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Terapkan keputusan ke kolom `status`. Pendaftar yang statusnya sudah diubah TANGAN oleh panitia
 *  dengan catatan khusus tetap ikut ditimpa — penetapan ini memang keputusan resminya; perubahan
 *  per orang dilakukan SETELAHNYA dari halaman Pendaftar. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json();
    const gelombangId = String(b?.gelombangId ?? "");
    if (!gelombangId) return NextResponse.json({ error: "Pilih gelombang dulu" }, { status: 400 });
    const cadangan = Math.max(0, Math.min(Number(b?.cadangan) || 0, 200));

    const hasil = await susunKeputusan(gelombangId, cadangan);
    const ubah: { id: string; status: string }[] = [];
    for (const j of hasil.jurusan) for (const p of j.pendaftar) if (p.status !== p.usul) ubah.push({ id: p.id, status: p.usul });

    if (!ubah.length) return NextResponse.json({ ok: true, diubah: 0 });

    await prisma.$transaction(
      ubah.map(u => prisma.admission.update({ where: { id: u.id }, data: { status: u.status } })),
    );
    await logActivity(session, {
      action: "UPDATE", entity: "Admission",
      description: `Menetapkan hasil seleksi SPMB "${hasil.gelombang}" — ${ubah.length} pendaftar diperbarui`,
    });
    return NextResponse.json({ ok: true, diubah: ubah.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menetapkan hasil" }, { status: 500 });
  }
}

async function susunKeputusan(gelombangId: string, cadangan: number) {
  const [gelombang, komponen, pendaftar] = await Promise.all([
    prisma.gelombangSpmb.findUnique({
      where: { id: gelombangId },
      include: { kuota: { include: { major: { select: { code: true, name: true } } } } },
    }),
    prisma.komponenNilaiSpmb.findMany({ where: { aktif: true } }),
    prisma.admission.findMany({
      where: { gelombangId },
      select: {
        id: true, nomor: true, fullName: true, chosenMajor: true, status: true,
        nilaiSpmb: { select: { komponenId: true, nilai: true, lulus: true } },
      },
    }),
  ]);
  if (!gelombang) throw new Error("Gelombang tidak ditemukan");

  // Kuota dicocokkan ke `chosenMajor` lewat KODE maupun NAMA jurusan — formulir lama menyimpan
  // salah satunya, jadi mencocokkan hanya satu bentuk membuat kuota tampak nol.
  const kuotaPer = new Map<string, number>();
  for (const k of gelombang.kuota) {
    kuotaPer.set(k.major.code, k.kuota);
    kuotaPer.set(k.major.name, k.kuota);
  }

  const perJurusan = new Map<string, typeof pendaftar>();
  for (const p of pendaftar) {
    const arr = perJurusan.get(p.chosenMajor) ?? [];
    arr.push(p); perJurusan.set(p.chosenMajor, arr);
  }

  const jurusan = [...perJurusan.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([nama, arr]) => {
    const dinilai = arr.map(p => {
      const h = hitungSkorSpmb(komponen, p.nilaiSpmb);
      return { ...p, skor: h.skor, gugur: h.gugur };
    });
    const bersaing = dinilai.filter(p => !p.gugur && p.skor !== null).sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0));
    const kuota = kuotaPer.get(nama) ?? 0;
    const batas = kuota > 0 ? kuota : bersaing.length; // kuota 0 = tidak dibatasi

    const usulPer = new Map<string, string>();
    bersaing.forEach((p, i) => {
      usulPer.set(p.id, i < batas ? "DITERIMA" : i < batas + cadangan ? "CADANGAN" : "DITOLAK");
    });
    for (const p of dinilai) {
      if (usulPer.has(p.id)) continue;
      // Gugur = ditolak. Belum dinilai = dibiarkan apa adanya, jangan ditolak diam-diam.
      usulPer.set(p.id, p.gugur ? "DITOLAK" : p.status);
    }

    return {
      nama, kuota,
      pendaftar: dinilai
        .map(p => ({
          id: p.id, nomor: p.nomor, fullName: p.fullName, skor: p.skor, gugur: p.gugur,
          status: p.status, usul: usulPer.get(p.id) ?? p.status,
          peringkat: bersaing.findIndex(x => x.id === p.id) + 1 || null,
        }))
        .sort((a, b) => (a.peringkat ?? 9999) - (b.peringkat ?? 9999)),
    };
  });

  return {
    gelombang: gelombang.nama,
    cadangan,
    jurusan,
    ringkas: {
      diterima: jurusan.reduce((a, j) => a + j.pendaftar.filter(p => p.usul === "DITERIMA").length, 0),
      cadangan: jurusan.reduce((a, j) => a + j.pendaftar.filter(p => p.usul === "CADANGAN").length, 0),
      ditolak: jurusan.reduce((a, j) => a + j.pendaftar.filter(p => p.usul === "DITOLAK").length, 0),
      belum: jurusan.reduce((a, j) => a + j.pendaftar.filter(p => !p.gugur && p.skor === null).length, 0),
    },
  };
}
