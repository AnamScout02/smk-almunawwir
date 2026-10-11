import "server-only";
import { prisma } from "@/lib/prisma";
import { jadwalHariGuru, simpanJurnalCepat, type KartuJurnal } from "@/lib/jurnal-cepat";

/** BOT TELEGRAM DUA ARAH (10 Oktober 2026, pilihan user) — akun guru yang SUDAH menautkan Telegram bisa bertanya dan
 *  mengisi jurnal dari obrolan:
 *    /jadwal  (atau "jadwal")   jadwal mengajar hari ini
 *    /jurnal  (atau "jurnal")   jam yang jurnalnya belum diisi, tiap jam satu pesan bertombol "Sesuai rencana"
 *    membalas pesan itu dengan teks = teks tersebut menjadi MATERI jurnal jam itu
 *    "materi: …"  tanpa membalas = berlaku bila hanya SATU jam yang belum diisi
 *  Aturan:
 *   - Orangnya dikenali dari `TautanTelegram.chatId` — tidak ada perintah yang menerima nama/NIP orang lain.
 *   - Jam yang diisi dikenali dari `scheduleId` di tombol pesan, lalu DIPERIKSA ULANG oleh `simpanJurnalCepat`
 *     (jadwal harus milik guru itu, berlaku hari ini, dan sudah dimulai).
 *   - Yang ditulis hanya MATERI. Kehadiran & nilai siswa tidak pernah diisi dari Telegram (CLAUDE.md #10).
 *  `kirim` disuntikkan supaya logikanya bisa diuji tanpa mengirim apa pun ke Telegram. */

export interface PesanKeluar { teks: string; tombol?: { teks: string; data: string }[] }
export type Pengirim = (p: PesanKeluar) => Promise<unknown>;
const AWALAN = "jc:";
const aman = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const baris = (k: KartuJurnal) => `<b>${aman(k.kelas)} · ${aman(k.mapel)}</b>\n${k.jamKe ? `jam ke-${k.jamKe} · ` : ""}${k.mulai}–${k.selesai}`;

async function guruDariObrolan(chatId: string) {
  const t = await prisma.tautanTelegram.findUnique({ where: { chatId }, select: { aktif: true, user: { select: { name: true, role: true, teacher: { select: { id: true } } } } } }).catch(() => null);
  if (!t?.aktif) return { tertaut: false as const };
  return { tertaut: true as const, nama: t.user.name, teacherId: t.user.teacher?.id ?? null };
}

/** Pesan teks biasa. Mengembalikan true bila ditangani (false = bukan perintah yang dikenal → pemanggil memberi petunjuk). */
export async function tanganiPesan(o: { chatId: string; teks: string; balasData?: string | null }, kirim: Pengirim): Promise<boolean> {
  const teks = o.teks.trim(), kecil = teks.toLowerCase();
  const mintaJadwal = /^\/jadwal\b/.test(kecil) || /^jadwal( saya)?( hari ini)?[?.!]*$/.test(kecil);
  const mintaJurnal = /^\/jurnal\b/.test(kecil) || /^jurnal( saya)?( belum( di)?isi)?[?.!]*$/.test(kecil);
  const isiMateri = /^(sudah[,.]?\s*)?materi\s*[:=-]\s*([\s\S]+)$/i.exec(teks)?.[2]?.trim() ?? null;
  const balasJam = o.balasData?.startsWith(AWALAN) ? o.balasData.slice(AWALAN.length) : null;
  if (!mintaJadwal && !mintaJurnal && !isiMateri && !balasJam) return false;

  const g = await guruDariObrolan(o.chatId);
  if (!g.tertaut) { await kirim({ teks: "Obrolan ini belum tertaut ke akun MyAlwis. Buka menu Profil di MyAlwis lalu tekan \"Hubungkan Telegram\"." }); return true; }
  if (!g.teacherId) { await kirim({ teks: "Perintah jadwal & jurnal hanya untuk akun guru." }); return true; }
  const h = await jadwalHariGuru(g.teacherId);
  if (h.libur) { await kirim({ teks: `Hari ini libur: ${aman(h.libur)}.` }); return true; }
  if (!h.kartu.length) { await kirim({ teks: "Hari ini Anda tidak punya jadwal mengajar." }); return true; }
  const belum = h.kartu.filter(k => !k.jurnalId && k.keadaan !== "NANTI");

  if (balasJam || isiMateri) {
    const sasaran = balasJam ? h.kartu.find(k => k.scheduleId === balasJam) : belum.length === 1 ? belum[0] : null;
    if (!sasaran) {
      await kirim({ teks: balasJam ? "Jam pelajaran itu tidak ada di jadwal Anda hari ini." : belum.length ? "Ada lebih dari satu jam yang belum diisi. Kirim /jurnal lalu balas pesan jam yang dimaksud dengan materinya." : "Semua jurnal hari ini sudah terisi." });
      return true;
    }
    const materi = (isiMateri ?? teks).slice(0, 1000);
    const s = await simpanJurnalCepat({ teacherId: g.teacherId, scheduleId: sasaran.scheduleId, materi });
    await kirim({ teks: s.ok ? `✅ Jurnal ${aman(sasaran.kelas)} tersimpan.\nMateri: ${aman(materi)}\n\nKehadiran & nilai siswa bisa dilengkapi di MyAlwis → Jurnal Mengajar.` : `Jurnal belum tersimpan: ${aman(s.pesan)}` });
    return true;
  }
  if (mintaJadwal) {
    const tanda = (k: KartuJurnal) => k.jurnalId ? "✅ jurnal terisi" : k.keadaan === "NANTI" ? "belum mulai" : "⚠️ jurnal belum diisi";
    await kirim({ teks: `<b>Jadwal mengajar hari ini</b>\n\n${h.kartu.map(k => `${baris(k)}\n${tanda(k)}`).join("\n\n")}${belum.length ? "\n\nKirim /jurnal untuk mengisinya dari sini." : ""}` });
    return true;
  }
  if (!belum.length) { await kirim({ teks: "Semua jurnal untuk jam yang sudah berjalan hari ini sudah terisi. 👍" }); return true; }
  for (const k of belum) {
    await kirim({
      teks: `${baris(k)}\n\n${k.saran ? `${k.saran.asal === "RENCANA" ? "Rencana (Prota/Promes)" : "Materi pertemuan lalu"}: ${aman(k.saran.teks)}\n\n` : ""}Balas pesan ini dengan materi yang diajarkan${k.saran ? ", atau tekan tombol bila sesuai" : ""}.`,
      tombol: [{ teks: k.saran ? "✅ Sesuai rencana" : "Jam ini", data: `${AWALAN}${k.scheduleId}` }],
    });
  }
  return true;
}

/** Tombol "Sesuai rencana". Mengembalikan teks singkat untuk jawaban tombol + pesan pengganti. */
export async function tanganiTombol(o: { chatId: string; data: string }): Promise<{ jawab: string; ganti?: string }> {
  if (!o.data.startsWith(AWALAN)) return { jawab: "Tombol tidak dikenal." };
  const g = await guruDariObrolan(o.chatId);
  if (!g.tertaut || !g.teacherId) return { jawab: "Obrolan ini belum tertaut ke akun guru." };
  const id = o.data.slice(AWALAN.length), h = await jadwalHariGuru(g.teacherId);
  const k = h.kartu.find(x => x.scheduleId === id);
  if (!k) return { jawab: "Jam itu bukan jadwal Anda hari ini." };
  if (k.jurnalId) return { jawab: "Jurnal jam ini sudah terisi.", ganti: `${baris(k)}\n✅ Jurnal sudah terisi: ${aman(k.materi ?? "")}` };
  if (!k.saran) return { jawab: "Belum ada rencana untuk jam ini — balas pesannya dengan materi." };
  const s = await simpanJurnalCepat({ teacherId: g.teacherId, scheduleId: id, materi: k.saran.teks });
  if (!s.ok) return { jawab: s.pesan.slice(0, 180) };
  return { jawab: "Jurnal tersimpan.", ganti: `${baris(k)}\n✅ Jurnal tersimpan: ${aman(k.saran.teks)}\n\nKehadiran & nilai siswa dilengkapi di MyAlwis → Jurnal Mengajar.` };
}
