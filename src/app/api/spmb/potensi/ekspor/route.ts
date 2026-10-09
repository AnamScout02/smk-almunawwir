import { NextRequest, NextResponse } from "next/server";
import { verifySpmbAccess } from "@/lib/spmb";
import { kabupatenBoleh, saringPotensi, susunPotensi } from "@/lib/potensi-smp";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await verifySpmbAccess();
    const boleh = await kabupatenBoleh();
    const kab = boleh.find(k => k.nama === req.nextUrl.searchParams.get("kab"))?.nama ?? boleh[0]?.nama;
    if (!kab) return NextResponse.json({ error: "Belum ada data." }, { status: 404 });
    const p = await susunPotensi(kab);
    const sp = req.nextUrl.searchParams;
    const f = saringPotensi(p, { kec: sp.get("kec") ?? "", jenjang: sp.get("jenjang") ?? "", status: sp.get("status") ?? "", q: sp.get("q") ?? "", urut: sp.get("urut") ?? "" });
    const th = p.tahunKita.length;
    return balasanExcel({
      namaFile: `potensi-lulusan-${kab.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, namaSheet: "Potensi Lulusan",
      headers: ["Kecamatan", "NPSN", "Sekolah", "Jenjang", "Status", "Akreditasi", "Alamat", "Jarak (km)", "Kelas IX L", "Kelas IX P", "Kelas IX", "Rombel IX", "Guru",
        "Kepala sekolah", "Nomor dihubungi", "Telepon sekolah", "Email", "Website", `Siswa kita ${p.tahunKita.join("-")}`, "Rata-rata per tahun", "Dicocokkan ke", "Dikunjungi", "Catatan", "Semester data"],
      rows: f.baris.map(b => [b.kecamatan, b.npsn, b.nama, b.bentuk, b.status, b.akreditasi ?? "", b.alamat ?? "", b.jarak, b.k9L, b.k9P, b.k9, b.rombel9, b.guru,
        b.kepala ?? "", b.kontak ?? "", b.telepon ?? "", b.email ?? "", b.website ?? "", b.kita, b.kita === null || !th ? null : Math.round((b.kita / th) * 10) / 10, b.namaKita ?? "",
        b.dikunjungi ?? "", b.catatan ?? "", b.semester ?? ""]),
    });
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Gagal membuat berkas." }, { status: 500 }); }
}
