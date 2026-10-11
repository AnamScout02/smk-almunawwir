import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hariKegiatan, isoWib, jendelaSekarang, kegiatanMilik, tengahMalamWib } from "@/lib/kegiatan-qr";
import { penerimaPengumuman } from "@/lib/pengumuman";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { alphakanAbsensiHarian, cabutAbsensiKegiatan, hadirkanAbsensiHarian } from "@/lib/absensi-otomatis";
import { pesertaKegiatan } from "@/lib/kegiatan-tidak-hadir";

export const dynamic = "force-dynamic";

async function sasaranBernama(k: { targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[]; targetUserIds?: string[] }) {
  const s = await pesertaKegiatan(k);
  const u = await prisma.user.findMany({
    where: { id: { in: s.map(x => x.userId) } },
    select: { id: true, name: true, student: { select: { class: { select: { name: true } } } } },
  });
  const peta = new Map(u.map(x => [x.id, x]));
  return s.map(x => ({ userId: x.userId, peran: x.peran, nama: peta.get(x.userId)?.name ?? "-", kelas: peta.get(x.userId)?.student?.class?.name ?? "" }))
    .sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nama.localeCompare(b.nama));
}

/** Hari mana yang sedang dilihat. Kegiatan berhari-hari: `?tanggal=YYYY-MM-DD`; tanpa parameter
 *  dipilih hari yang sedang berlangsung, kalau di luar jam dipilih hari pertama. */
function hariDipilih(k: { mulai: Date; selesai: Date; sampaiTanggal: Date | null }, minta: string | null) {
  const hari = hariKegiatan(k);
  if (minta && hari.includes(minta)) return { hari, dipilih: minta };
  const sekarang = jendelaSekarang(k);
  return { hari, dipilih: sekarang ? isoWib(sekarang.mulai) : hari[0] };
}

/** Rekap hadir & belum hadir PADA SATU HARI. ?format=xlsx untuk unduhan daftar hadir. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const { hari, dipilih } = hariDipilih(m.k, sp.get("tanggal"));
  const [hadir, sasaran] = await Promise.all([
    prisma.presensiKegiatan.findMany({
      where: { kegiatanId: id, tanggal: tengahMalamWib(dipilih) },
      orderBy: { waktu: "asc" },
    }),
    sasaranBernama(m.k),
  ]);
  const sudah = new Set(hadir.map(h => h.userId));
  const belum = sasaran.filter(s => !sudah.has(s.userId));
  const kelasDari = new Map(sasaran.map(s => [s.userId, s.kelas]));
  if (sp.get("format") === "xlsx") {
    const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    // Ringkasan per kelompok (kelas & "Guru & Staf") supaya rekap "siapa tidak hadir di kelas mana"
    // bisa langsung dicetak, bukan dihitung tangan dari dua daftar panjang.
    const kelompok = (peran: string, kelas: string) =>
      kelas || (peran === "STUDENT" || peran === "PARENT" ? "Tanpa kelas" : "Guru & Staf");
    const hitung = new Map<string, { hadir: number; belum: number }>();
    const naikkan = (n: string, k: "hadir" | "belum") => {
      const x = hitung.get(n) ?? { hadir: 0, belum: 0 };
      x[k]++; hitung.set(n, x);
    };
    for (const h of hadir) naikkan(kelompok(h.peran, kelasDari.get(h.userId) ?? ""), "hadir");
    for (const b of belum) naikkan(kelompok(b.peran, b.kelas), "belum");
    const ringkasan = [...hitung.entries()]
      .sort(([a], [b]) => (a === "Guru & Staf" ? 1 : 0) - (b === "Guru & Staf" ? 1 : 0) || a.localeCompare(b, "id", { numeric: true }))
      .map(([nama, x], i) => [i + 1, nama, x.hadir, x.belum, x.hadir + x.belum]);
    return balasanExcelBanyakSheet(`presensi-${dipilih}`, [
      { nama: "Ringkasan", headers: ["No", "Kelas / Kelompok", "Hadir", "Tidak Hadir", "Jumlah"], rows: ringkasan },
      { nama: "Hadir", headers: ["No", "Kelas / Kelompok", "Nama", "Peran", "Jam", "Cara", "Keterangan"], rows: hadir.map((h, i) => [i + 1, kelompok(h.peran, kelasDari.get(h.userId) ?? ""), h.nama, h.peran, jam(h.waktu), h.metode === "QR" ? "Pindai QR" : "Dicatat panitia", h.keterangan ?? ""]) },
      { nama: "Tidak Hadir", headers: ["No", "Kelas / Kelompok", "Nama", "Peran"], rows: belum.map((b, i) => [i + 1, kelompok(b.peran, b.kelas), b.nama, b.peran]) },
    ]);
  }
  return Response.json({
    kegiatan: m.k,
    hari, tanggal: dipilih,
    hadir: hadir.map(h => ({ ...h, kelas: kelasDari.get(h.userId) ?? "" })),
    belum, jumlahSasaran: sasaran.length,
  });
}

/** Catat manual: `{userId}` untuk satu orang, atau `{userIds: [...]}` untuk SATU KELAS / rombongan
 *  guru sekaligus (permintaan user 30 September 2026 — memanggil satu per satu tidak masuk akal untuk
 *  kegiatan sekelas). Ditambah `keterangan` & `tanggal`; `tanggal` penting untuk kegiatan berhari-hari
 *  supaya panitia tidak tanpa sadar menandai hari yang salah. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  // "Tidak hadir = Alpha di absen kelas" (10 Okt 2026): tombol panitia di tab Tidak Hadir. Hanya siswa sasaran yang
  // hari itu TANPA presensi kegiatan dan TANPA catatan absensi; hari yang belum lewat ditolak (kegiatan masih berjalan).
  if (b.alpha === true) {
    const { dipilih } = hariDipilih(m.k, String(b.tanggal ?? "") || null);
    const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const jamSelesaiHariItu = m.k.selesai.getTime() + (new Date(`${dipilih}T00:00:00Z`).getTime() - new Date(`${isoWib(m.k.mulai)}T00:00:00Z`).getTime());
    if (dipilih > hariIni || Date.now() < jamSelesaiHariItu) return Response.json({ error: "Kegiatan hari itu belum selesai — yang belum hadir masih bisa datang." }, { status: 409 });
    const sudah = new Set((await prisma.presensiKegiatan.findMany({ where: { kegiatanId: id, tanggal: tengahMalamWib(dipilih) }, select: { userId: true } })).map(x => x.userId));
    const belum = (await pesertaKegiatan(m.k)).map(x => x.userId).filter(u => !sudah.has(u));
    const n = await alphakanAbsensiHarian(belum, dipilih);
    return Response.json({ ok: true, alpha: n });
  }
  const diminta: string[] = Array.isArray(b.userIds)
    ? [...new Set((b.userIds as unknown[]).map(x => String(x)).filter(Boolean))].slice(0, 500)
    : [String(b.userId ?? "")].filter(Boolean);
  if (!diminta.length) return Response.json({ error: "Tidak ada peserta yang dipilih." }, { status: 400 });

  // Hanya orang yang MEMANG jadi sasaran kegiatan ini yang boleh dicatat — jangan percaya daftar id
  // dari browser (pola sama dengan absensi siswa, CLAUDE.md #10).
  const sasaran = new Set((await penerimaPengumuman(m.k)).map(x => x.userId));
  const sah = diminta.filter(x => sasaran.has(x));
  if (!sah.length) return Response.json({ error: "Peserta tidak termasuk sasaran kegiatan ini." }, { status: 400 });

  const orang = await prisma.user.findMany({ where: { id: { in: sah } }, select: { id: true, name: true, role: true } });
  if (!orang.length) return Response.json({ error: "Peserta tidak ditemukan." }, { status: 404 });
  const keterangan = String(b.keterangan ?? "").trim().slice(0, 200) || null;
  const { dipilih } = hariDipilih(m.k, String(b.tanggal ?? "") || null);
  const tanggal = tengahMalamWib(dipilih);
  await prisma.$transaction(orang.map(u => prisma.presensiKegiatan.upsert({
    where: { kegiatanId_userId_tanggal: { kegiatanId: id, userId: u.id, tanggal } },
    create: { kegiatanId: id, userId: u.id, nama: u.name, peran: u.role, metode: "MANUAL", keterangan, tanggal },
    update: { keterangan },
  })));
  // Lihat catatan di src/lib/absensi-otomatis.ts — mengisi absensi harian yang masih kosong saja.
  const harian = await hadirkanAbsensiHarian(orang.map(u => u.id), dipilih, keterangan).catch(() => null);
  return Response.json({ ok: true, tersimpan: orang.length, absensiHarian: harian });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const userId = sp.get("userId") ?? "";
  const { dipilih } = hariDipilih(m.k, sp.get("tanggal"));
  await prisma.presensiKegiatan.deleteMany({ where: { kegiatanId: id, userId, tanggal: tengahMalamWib(dipilih) } });
  // Absensi kelas yang berasal dari presensi ini ikut dicabut (isian wali kelas tidak disentuh).
  await cabutAbsensiKegiatan(userId, dipilih).catch(() => null);
  return Response.json({ ok: true });
}
