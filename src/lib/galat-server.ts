import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** PENCATAT GALAT SERVER (10 Oktober 2026) — pengganti ringan GlitchTip/Sentry: `onRequestError` di instrumentation.ts
 *  memanggil `catatGalat` untuk tiap galat yang tidak tertangkap saat merender halaman / menjalankan route. Satu baris per
 *  JENIS galat (`sidik` = pesan tanpa angka/id + jalur rute), dihitung; Superadmin yang menautkan Telegram dikabari saat
 *  jenis itu PERTAMA muncul dan paling sering sekali per 6 jam sesudahnya. Dipilih daripada GlitchTip karena layanan itu
 *  butuh basis data + Redis + pekerja sendiri (±1 GB RAM) di server yang RAM-nya 8 GB dan sudah terpakai 5.
 *  Yang TIDAK dicatat: pengalihan & 404 (bukan galat), dan isi permintaan (bisa memuat data pribadi) — hanya jalur. */
const JEDA_KABAR = 6 * 3600_000, BATAS_BARIS = 500;
const tanpaRagam = (t: string) => t.replace(/\bc[a-z0-9]{20,}\b/g, "<id>").replace(/\d{3,}/g, "<n>");

export async function catatGalat(galat: unknown, info: { jalur: string; metode?: string; jenis?: string; rute?: string }) {
  try {
    const e = galat as { message?: string; stack?: string; digest?: string };
    const pesan = String(e?.message ?? galat ?? "Galat tanpa pesan").slice(0, 500);
    if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/.test(`${e?.digest ?? ""} ${pesan}`)) return;
    const jalur = (info.rute || info.jalur.split("?")[0]).slice(0, 200);
    const sidik = createHash("sha1").update(`${tanpaRagam(pesan)}|${tanpaRagam(jalur)}`).digest("hex");
    const kini = new Date();
    const lama = await prisma.galatServer.findUnique({ where: { sidik }, select: { id: true, diberitahuAt: true } });
    const kabari = !lama?.diberitahuAt || kini.getTime() - lama.diberitahuAt.getTime() > JEDA_KABAR;
    const baris = await prisma.galatServer.upsert({
      where: { sidik },
      create: { sidik, pesan, jalur: info.jalur.split("?")[0].slice(0, 200), metode: info.metode ?? null, jenis: info.jenis ?? null, tumpukan: (e?.stack ?? "").slice(0, 4000) || null, diberitahuAt: kini },
      update: { jumlah: { increment: 1 }, terakhir: kini, jalur: info.jalur.split("?")[0].slice(0, 200), tumpukan: (e?.stack ?? "").slice(0, 4000) || undefined, ...(kabari ? { diberitahuAt: kini } : {}) },
      select: { jumlah: true },
    });
    if (kabari) {
      const { peringatanServer } = await import("@/lib/telegram");
      await peringatanServer(lama ? `Galat server berulang (${baris.jumlah}×)` : "Galat server baru", `${pesan}\n${info.metode ?? ""} ${jalur}`.trim(), "/dashboard/admin/galat-server");
    }
    if (!lama && Math.random() < 0.05) {
      const basi = await prisma.galatServer.findMany({ orderBy: { terakhir: "desc" }, skip: BATAS_BARIS, select: { id: true } });
      if (basi.length) await prisma.galatServer.deleteMany({ where: { id: { in: basi.map(b => b.id) } } });
    }
  } catch { /* pencatat galat tidak boleh menimbulkan galat */ }
}
