// Sampler bandwidth periodik — dipanggil SEKALI saat proses server Next.js mulai (bukan per
// request), lalu jalan sendiri di background lewat setInterval. Tujuannya: isi riwayat bandwidth
// (tabel BandwidthLog) supaya grafik Jaringan Sekolah bisa difilter per rentang waktu (mirip MRTG),
// bukan cuma live-polling dari browser yang datanya hilang begitu tab ditutup.
//
// Stabil sejak Next.js 15 (lihat node_modules/next/dist/docs/.../instrumentation.md), tidak perlu
// flag experimental apa pun.
const SAMPLE_INTERVAL_MS = 5 * 60 * 1000; // 5 menit

// Tagihan Terjadwal (modul Bendahara) — cek tiap 1 jam apakah ada BillingSchedule yang siklus
// berikutnya sudah jatuh tempo, generate otomatis kalau ada. Idempoten (aman dicek berkali-kali,
// lihat komentar runDueBillingSchedules) jadi interval 1 jam cukup longgar, tidak perlu presisi
// ke menit — pola sama persis sampler bandwidth di bawah, cuma beda selang waktu.
const BILLING_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 jam

const PENGINGAT_INTERVAL_MS = 5 * 60 * 1000; // 5 menit

export async function register() {
  // Cuma jalan di runtime Node (bukan Edge) — Prisma & koneksi Mikrotik tidak jalan di Edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");
  const { withMikrotik } = await import("@/lib/mikrotik");

  async function checkBillingSchedules() {
    try {
      const { runDueBillingSchedules } = await import("@/lib/billing-schedule");
      await runDueBillingSchedules();
    } catch {
      // Jangan sampai bikin proses server crash krn 1 jadwal error — coba lagi jam berikutnya.
    }
  }
  checkBillingSchedules();
  setInterval(checkBillingSchedules, BILLING_CHECK_INTERVAL_MS);

  // Pengingat notifikasi push (absensi kelas, buku piket, jurnal, ujian dimulai) — dicek tiap 5 menit,
  // idempoten per kunci (lihat src/lib/pengingat-terjadwal.ts). Tunda 1 menit setelah server hidup.
  async function cekPengingat() {
    try {
      const { jalankanPengingat } = await import("@/lib/pengingat-terjadwal");
      await jalankanPengingat();
    } catch {
      // Jangan sampai proses server crash — coba lagi 5 menit berikutnya.
    }
  }
  setTimeout(cekPengingat, 60_000);
  setInterval(cekPengingat, PENGINGAT_INTERVAL_MS);

  async function sampleOnce() {
    try {
      const rows = await withMikrotik(async (conn) => {
        const interfaces = await conn.write("/interface/print");
        const names = interfaces.filter((i) => i.disabled === "false").map((i) => i.name);
        if (names.length === 0) return [];
        return conn.write("/interface/monitor-traffic", [`=interface=${names.join(",")}`, "=once="]);
      });
      if (rows.length === 0) return;
      await prisma.bandwidthLog.createMany({
        data: rows.map((r) => ({
          interface: r.name,
          downloadMbps: Math.round((Number(r["rx-bits-per-second"] ?? 0) / 1_000_000) * 100) / 100,
          uploadMbps: Math.round((Number(r["tx-bits-per-second"] ?? 0) / 1_000_000) * 100) / 100,
        })),
      });
    } catch {
      // Mikrotik tidak terjangkau / config belum diisi — lewati siklus ini, coba lagi 5 menit
      // berikutnya. Sengaja senyap (tidak throw) supaya tidak membanjiri log server tiap 5 menit
      // di lingkungan yang memang belum setup Mikrotik-nya.
    }
  }

  sampleOnce();
  setInterval(sampleOnce, SAMPLE_INTERVAL_MS);
}
