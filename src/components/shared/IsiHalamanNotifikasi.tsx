export const dynamic = "force-dynamic";

import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { pengumumanUntuk } from "@/lib/pengumuman";
import { antreanPortal } from "@/lib/antrean-portal";
import { tugasHariIni } from "@/lib/tugas-hari-ini";
import { tandaiPengingatSelesai } from "@/lib/kotak-notifikasi";
import PageHeader from "@/components/admin/PageHeader";
import PusatNotifikasiHalaman from "@/components/shared/PusatNotifikasiHalaman";
import { TautanIkon } from "@/components/shared/IkonNama";
import { berandaPortal } from "@/lib/rute-portal";
import TombolKembali from "@/components/shared/TombolKembali";

/** PUSAT NOTIFIKASI (18 September 2026) — isi halaman notifikasi, dipakai bersama oleh keempat
 * portal. Tiga jenis dalam satu daftar, dipisah pita tab: Perlu tindakan · Kabar · Pengumuman.
 *
 * DIPASANG DI DALAM /dashboard (bukan sebagai halaman root sendiri) supaya ikut layout portal:
 * sidebar, bottom navbar, dan latar dashboard. Sebagai halaman root, ketiganya hilang dan
 * tampilannya beda sendiri dari halaman lain (temuan user 18 Sep 2026). `/notifikasi` sekarang
 * cuma PINTU yang mengalihkan ke rute portal masing-masing — pola yang sama dengan
 * /pengumuman & /survei (CLAUDE.md #46). */
export default async function IsiHalamanNotifikasi() {
  const session = await verifySession();
  // Pengingat yang tugasnya sudah dikerjakan ditandai dibaca dulu, sama seperti saat kotak dibuka.
  const tugas = await tugasHariIni(session.userId).catch(() => null);
  if (tugas) await tandaiPengingatSelesai(session.userId, tugas).catch(() => 0);

  const [baris, pengumuman, tindakan] = await Promise.all([
    prisma.notifikasiPengguna.findMany({
      where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 60,
      select: { id: true, dibacaAt: true, createdAt: true, notifikasi: { select: { jenis: true, judul: true, isi: true, url: true } } },
    }).catch(() => []),
    pengumumanUntuk(session, 20).catch(() => []),
    antreanPortal(session).catch(() => []),
  ]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Bell size={22} />} title="Notifikasi"
        description="Kabar, pengingat, dan pengumuman untuk akun Anda" />
      {/* Halaman ini dibuka dari lonceng di halaman mana pun (tidak ada di menu sidebar), jadi ia
          wajib punya jalan pulang sendiri — sama seperti halaman lain di luar menu. */}
      <div className="flex mb-5">
        <TombolKembali href={berandaPortal(session.role)} />
      </div>
      <PusatNotifikasiHalaman
        tindakan={tindakan}
        notifikasi={baris.map(b => ({
          id: b.id, dibaca: !!b.dibacaAt, waktu: b.createdAt.toISOString(),
          jenis: b.notifikasi.jenis, judul: b.notifikasi.judul, isi: b.notifikasi.isi, url: b.notifikasi.url,
        }))}
        pengumuman={pengumuman.map(p => ({
          id: p.id, judul: p.title, isi: p.content, penting: p.priority, wajibKonfirmasi: p.wajibKonfirmasi,
          sudahDibaca: p.dibaca, oleh: p.pembuatNama, waktu: p.startDate ? p.startDate.toISOString() : null,
        }))}
      />
    </div>
  );
}
