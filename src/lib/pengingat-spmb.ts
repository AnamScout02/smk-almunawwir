import "server-only";
import { prisma } from "@/lib/prisma";
import type { IsiNotifikasi } from "@/lib/push-server";
import { kabariCalon } from "@/lib/spmb-kabar";
import { aturanTahapan, denganBayar, jadwalDenganSesi, PILIH_TAHAPAN, ringkasBayar, setelanBayar } from "@/lib/spmb-tahapan-server";
import { susunTahapan } from "@/lib/spmb-tahapan";

/** PENGINGAT CALON SPMB (6 Oktober 2026) — dijalankan `jalankanPengingat` pada jam `notifikasi.jamSpmb`.
 *  Hanya untuk calon yang MENGAKTIFKAN pemberitahuan (`LanggananSpmb`); kabar tetap dicatat `KabarSpmb` berkunci,
 *  jadi pemanggilan berulang dalam satu jendela tidak mengirim dobel.
 *   - H-1 jadwal datang ke sekolah (sesi yang dipilih, atau jadwal asesmen gelombang).
 *   - Tiap 3 hari selama calon TERTAHAN di tahap yang harus ia kerjakan sendiri: perbaikan berkas, pilih ukuran
 *     seragam, pilih sesi kedatangan, konfirmasi daftar ulang.
 *  Mode pratinjau (`kering`): tidak mengirim apa pun, hanya melaporkan lewat `kirim` (dengan id palsu `calon:<id>`). */
export async function pengingatSpmb(w: { tanggal: string }, opsi: { kirim: (n: IsiNotifikasi) => Promise<unknown>; kering?: boolean }) {
  const besok = new Date(new Date(`${w.tanggal}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10);
  const blok3 = Math.floor(new Date(`${w.tanggal}T00:00:00Z`).getTime() / 86400_000 / 3);
  const [calon, aturan, setBayar] = await Promise.all([
    prisma.admission.findMany({
      where: { langgananSpmb: { some: {} }, status: { notIn: ["DITOLAK", "REJECTED"] }, studentId: null },
      select: {
        ...PILIH_TAHAPAN, id: true, sesiId: true, sesi: true,
        gelombang: { select: { jadwalTahap: true, _count: { select: { sesi: true } } } },
      },
    }),
    aturanTahapan(), setelanBayar(),
  ]);
  if (!calon.length) return;
  const peta = await ringkasBayar(calon.map(c => c.id));

  for (const mentah of calon) {
    const a = denganBayar(mentah, setBayar, peta);
    const jadwal = jadwalDenganSesi(a.gelombang?.jadwalTahap, a.sesi);
    const { tahap, tuntas } = susunTahapan(a, aturan, jadwal);
    if (tuntas) continue;
    const kini = tahap.find(t => t.status === "BERJALAN" || t.status === "PERBAIKAN");
    if (!kini) continue;
    const kabar: { kunci: string; judul: string; isi: string }[] = [];

    // H-1 datang ke sekolah.
    const jd = kini.kode === "ASESMEN" || kini.kode === "PEMERIKSAAN" || kini.kode === "DAFTAR_ULANG" ? jadwal[kini.kode] : null;
    if (jd?.tanggal === besok) {
      kabar.push({
        kunci: `spmb-h1:${a.id}:${kini.kode}:${besok}`, judul: "Besok jadwal ke sekolah",
        isi: `Besok ${kini.judul.toLowerCase()}${jd.jamMulai ? ` pukul ${jd.jamMulai}` : ""}${jd.tempat ? ` di ${jd.tempat}` : ""}.${jd.catatan ? ` ${jd.catatan}` : ""}`,
      });
    }
    // Tertahan di tahap milik calon.
    const tunggu: Record<string, string> = {
      PERBAIKAN: "Berkas pendaftaran Anda masih perlu diperbaiki. Unggah ulang lewat halaman tahapan.",
      SERAGAM: "Ukuran seragam belum dipilih. Pilih lewat halaman tahapan supaya pesanan bisa diproses.",
      DAFTAR_ULANG: "Konfirmasi daftar ulang belum dilakukan. Buka halaman tahapan untuk melanjutkan.",
    };
    const kunciTunggu = kini.status === "PERBAIKAN" ? "PERBAIKAN"
      : kini.kode === "SERAGAM" ? "SERAGAM"
      : kini.kode === "DAFTAR_ULANG" && !a.daftarUlangConfirmedAt ? "DAFTAR_ULANG"
      : kini.kode === "ASESMEN" && !a.sesiId && (a.gelombang?._count.sesi ?? 0) > 0 ? "SESI" : null;
    if (kunciTunggu) {
      kabar.push({
        kunci: `spmb-ingat:${a.id}:${kunciTunggu}:${blok3}`, judul: "Pengingat pendaftaran",
        isi: kunciTunggu === "SESI" ? "Sesi kedatangan untuk asesmen & cek kesehatan belum dipilih. Pilih sebelum kuotanya penuh." : tunggu[kunciTunggu],
      });
    }

    for (const k of kabar) {
      if (opsi.kering) await opsi.kirim({ userIds: [`calon:${a.id}`], jenis: "SPMB", judul: k.judul, isi: k.isi, kunci: k.kunci });
      else await kabariCalon(a.id, k).catch(() => null);
    }
  }
}
