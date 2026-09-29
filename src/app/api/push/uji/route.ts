import { verifySession } from "@/lib/dal";
import { kirimNotifikasi } from "@/lib/push-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Kirim notifikasi uji ke semua perangkat milik pengguna ini (tombol "Kirim uji" di kartu Notifikasi). */
export async function POST() {
  let session: Awaited<ReturnType<typeof verifySession>>;
  try {
    session = await verifySession();
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(`push-uji:${session.userId}`, 5, 10 * 60_000)) {
    return Response.json({ error: "Terlalu sering. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  const hasil = await kirimNotifikasi({
    userIds: [session.userId],
    jenis: "UJI",
    judul: "Notifikasi sudah aktif",
    isi: "Perangkat ini akan menerima pengingat dan kabar penting dari SMK Al Munawwir IIBS.",
    url: "/login",
    tag: "uji",
  });
  if (!hasil.terkirim) {
    return Response.json({ error: hasil.alasan === "VAPID belum dikonfigurasi" ? "Notifikasi belum disiapkan di server." : "Belum ada perangkat yang aktif menerima notifikasi." }, { status: 409 });
  }
  return Response.json({ ok: true, perangkat: hasil.perangkat });
}
