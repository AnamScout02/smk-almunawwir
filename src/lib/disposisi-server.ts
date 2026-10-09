import "server-only";
import { prisma } from "@/lib/prisma";
import { kirimNotifikasi } from "@/lib/push-server";

/** Akun yang DITUJU sebuah disposisi. `tujuan` berisi NAMA JABATAN atau NAMA ORANG — keduanya dicocokkan. */
export async function akunTujuan(tujuan: string[]): Promise<string[]> {
  if (!tujuan.length) return [];
  const [jabatanGuru, jabatanStaf, orang] = await Promise.all([
    prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: { in: tujuan } } } } }, select: { userId: true } }),
    prisma.user.findMany({ where: { role: "TAS", staffJabatan: { some: { jabatan: { name: { in: tujuan } } } } }, select: { id: true } }),
    prisma.user.findMany({ where: { name: { in: tujuan }, role: { in: ["TEACHER", "TAS", "ADMIN"] } }, select: { id: true } }),
  ]);
  return [...new Set([...jabatanGuru.map(g => g.userId), ...jabatanStaf.map(x => x.id), ...orang.map(x => x.id)])];
}

/** Kabari yang dituju. Tautannya PINTU `/disposisi-surat` — guru tidak bisa membuka halaman admin (CLAUDE.md #45), dan dulu
 *  notifikasi ini menunjuk `/dashboard/admin/disposisi` sehingga guru yang dituju tidak pernah bisa membukanya. */
export async function kabariTujuanDisposisi(row: { id: string; tujuan: string[]; sifat: string; instruksi: string; batasWaktu: Date | null; surat: { perihal: string } }) {
  const userIds = await akunTujuan(row.tujuan);
  if (!userIds.length) return;
  await kirimNotifikasi({
    userIds, jenis: "PENGUMUMAN", kunci: `disposisi:${row.id}`,
    judul: `Disposisi ${row.sifat === "BIASA" ? "" : row.sifat.replace("_", " ").toLowerCase() + " "}— ${row.surat.perihal}`.replace("  ", " "),
    isi: `${row.instruksi.slice(0, 120)}${row.batasWaktu ? ` · batas ${row.batasWaktu.toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}` : ""}`,
    url: "/disposisi-surat", tag: `disposisi-${row.id}`,
  });
}

/** Surat masuk baru → kabari pimpinan (pemegang jabatan Kepala Sekolah) supaya bisa mendisposisi dari HP. */
export async function kabariSuratMasuk(surat: { id: string; pihak: string; perihal: string }) {
  const kepala = await prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: "Kepala Sekolah" } } } }, select: { userId: true } });
  if (!kepala.length) return;
  await kirimNotifikasi({
    userIds: kepala.map(k => k.userId), jenis: "PENGUMUMAN", kunci: `surat-masuk:${surat.id}`,
    judul: "Surat masuk menunggu disposisi", isi: `${surat.pihak} — ${surat.perihal}`.slice(0, 160), url: "/disposisi-surat", tag: `surat-masuk-${surat.id}`,
  });
}

/** Pilihan tujuan untuk pimpinan: nama JABATAN yang benar-benar ada pemegangnya + nama pegawai. Daftar umum lama
 *  (`TUJUAN_DISPOSISI_UMUM`) memakai sebutan yang tidak sama dengan nama jabatan di sistem, sehingga penerimanya tidak pernah
 *  dikabari — di sini pilihannya diambil dari data supaya selalu sampai ke orangnya. */
export async function pilihanTujuan() {
  const [jabatan, pegawai] = await Promise.all([
    prisma.jabatan.findMany({ where: { OR: [{ teachers: { some: {} } }, { staff: { some: {} } }] }, select: { name: true }, orderBy: { name: "asc" } }).catch(() => [] as { name: string }[]),
    prisma.user.findMany({ where: { role: { in: ["TEACHER", "TAS"] } }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return { jabatan: jabatan.map(j => j.name).filter(n => n !== "Kepala Sekolah"), pegawai: pegawai.map(p => p.name) };
}
