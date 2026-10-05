import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { kunciBerkas } from "@/lib/foto-kartu";

export const dynamic = "force-dynamic";

/** UNGGAH FOTO KARTU (KTS) MASSAL (4 Okt 2026, permintaan user: "unggah massal pakai NIS/NISN").
 *  Dua langkah supaya tidak ada foto yang tersimpan ke orang yang salah:
 *   1. `cocok`  — hanya NAMA berkas yang dikirim; server mencocokkan ke NIS/NISN (siswa) atau NIP (guru) dan
 *                 membalas pratinjau. Belum ada berkas yang diunggah.
 *   2. `simpan` — setelah petugas melihat pratinjau, berkas yang cocok diunggah lewat /api/upload lalu
 *                 alamatnya disimpan ke `bukuIndukData.fotoKartuUrl`. Foto Masuk/Keluar TIDAK disentuh.
 *  Nama berkas tidak bisa memuat "/", jadi NIS `001/001.064` boleh ditulis `001-001.064` / `001_001.064` /
 *  `001001064` — semua dicocokkan setelah tanda bacanya dibuang (kunciBerkas). */
type Jenis = "SISWA" | "GURU";

async function daftarOrang(jenis: Jenis) {
  if (jenis === "GURU") {
    const g = await prisma.teacher.findMany({ select: { id: true, nip: true, bukuIndukData: true, user: { select: { name: true } } } });
    return g.map(t => ({ id: t.id, nama: t.user.name, kelas: null as string | null, kunci: [t.nip].filter(Boolean) as string[], data: t.bukuIndukData }));
  }
  const s = await prisma.student.findMany({
    where: { studentStatus: "AKTIF" },
    select: { id: true, nis: true, nisn: true, bukuIndukData: true, user: { select: { name: true } }, class: { select: { name: true } } },
  });
  return s.map(x => ({ id: x.id, nama: x.user.name, kelas: x.class?.name ?? null, kunci: [x.nis, x.nisn].filter(Boolean) as string[], data: x.bukuIndukData }));
}

const adaFotoKartu = (d: unknown) => !!(d && typeof d === "object" && typeof (d as Record<string, unknown>).fotoKartuUrl === "string" && (d as Record<string, unknown>).fotoKartuUrl);

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();   // Admin, staf TU, atau guru berjabatan TU — sama dengan halaman Kartu Tanda
    const b = await req.json().catch(() => ({})) as { langkah?: string; jenis?: string; nama?: unknown; pasangan?: unknown };
    const jenis: Jenis = b.jenis === "GURU" ? "GURU" : "SISWA";
    const orang = await daftarOrang(jenis);

    if (b.langkah === "cocok") {
      const nama = Array.isArray(b.nama) ? b.nama.filter((x): x is string => typeof x === "string").slice(0, 1500) : [];
      // Peta kunci → orang. Kunci yang dimiliki >1 orang (mis. NISN ganda) ditandai GANDA, tidak dipilihkan.
      const peta = new Map<string, (typeof orang)[number] | "GANDA">();
      for (const o of orang) for (const k of o.kunci.map(kunciBerkas).filter(Boolean)) {
        const lama = peta.get(k);
        peta.set(k, lama && lama !== "GANDA" && lama.id !== o.id ? "GANDA" : o);
      }
      const dipakai = new Map<string, number>();
      const hasil = nama.map(n => {
        const o = peta.get(kunciBerkas(n.replace(/\.[^.]+$/, "")));
        if (!o) return { berkas: n, status: "TIDAK_DIKENAL" as const };
        if (o === "GANDA") return { berkas: n, status: "GANDA" as const };
        dipakai.set(o.id, (dipakai.get(o.id) ?? 0) + 1);
        return { berkas: n, status: "COCOK" as const, id: o.id, nama: o.nama, kelas: o.kelas, sudahAda: adaFotoKartu(o.data) };
      });
      // Dua berkas untuk orang yang sama → keduanya ditahan; petugas memilih sendiri.
      return Response.json({ hasil: hasil.map(h => h.status === "COCOK" && (dipakai.get(h.id!) ?? 0) > 1 ? { ...h, status: "DOBEL" as const } : h) });
    }

    if (b.langkah === "simpan") {
      const pasangan = (Array.isArray(b.pasangan) ? b.pasangan : [])
        .filter((p): p is { id: string; url: string } => !!p && typeof (p as { id?: unknown }).id === "string" && typeof (p as { url?: unknown }).url === "string")
        .filter(p => /^\/(api\/)?uploads\/[\w./-]+$/.test(p.url) && !p.url.includes(".."))
        .slice(0, 1500);
      const milik = new Map(orang.map(o => [o.id, o]));
      let tersimpan = 0;
      for (const p of pasangan) {
        const o = milik.get(p.id);
        if (!o) continue;
        const data = { ...((o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>), fotoKartuUrl: p.url };
        if (jenis === "GURU") await prisma.teacher.update({ where: { id: o.id }, data: { bukuIndukData: data } });
        else await prisma.student.update({ where: { id: o.id }, data: { bukuIndukData: data } });
        tersimpan++;
      }
      await logActivity(session, {
        action: "FOTO_KARTU_MASSAL", entity: jenis === "GURU" ? "Teacher" : "Student", entityId: "-",
        description: `Mengunggah Foto Kartu (KTS) massal: ${tersimpan} ${jenis === "GURU" ? "guru" : "siswa"}`,
      });
      return Response.json({ ok: true, tersimpan });
    }
    return Response.json({ error: "Langkah tidak dikenal." }, { status: 400 });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") return Response.json({ error: "Khusus staf Tata Usaha." }, { status: 403 });
    return Response.json({ error: "Gagal memproses foto kartu." }, { status: 500 });
  }
}
