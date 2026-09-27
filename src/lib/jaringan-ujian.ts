import "server-only";
import { prisma } from "@/lib/prisma";
import { withMikrotik, type MikrotikRow } from "@/lib/mikrotik";
import { getSettings } from "@/lib/site-settings";

/** MODE UJIAN JARINGAN (24 September 2026) — saat ada siswa yang SEDANG mengerjakan CBT, router otomatis
 * menutup hiburan di jaringan siswa supaya bandwidth tidak habis dan pengerjaan tidak terganggu; begitu
 * ujian selesai, semuanya kembali normal tanpa ada yang perlu membuka Winbox.
 *
 * Keputusan rancangan yang penting:
 * - **Pemicunya PENGERJAAN AKTIF, bukan jendela ujian.** Jendela SAS sekolah ini bisa terbuka berhari-hari
 *   (21–24 September), jadi memakai jendela berarti hiburan mati tiga hari penuh. Yang dipakai: ada attempt
 *   yang belum dikumpulkan dan berdenyut dalam beberapa menit terakhir, plus masa tenggang setelahnya.
 * - **Aturan dibuat sekali lalu dinyalakan/dimatikan**, bukan dibuat-hapus. Menyisipkan aturan baru tiap kali
 *   berisiko mengacak urutan firewall yang sudah berjalan; menyalakan/mematikan yang sudah ada aman dan cepat.
 * - Semua aturan diberi komentar berawalan `SMK-UJIAN` — itu satu-satunya penanda kepemilikan. Jangan pernah
 *   menyentuh aturan lain, dan jangan menghapus aturan yang komentarnya bukan milik kita.
 * - **Bawaannya MATI.** Fitur ini mengubah internet satu sekolah, jadi tidak boleh aktif diam-diam; admin
 *   harus menyalakannya sendiri di halaman pengaturannya.
 * - Blokirnya memakai `tls-host` (nama situs di dalam sapaan TLS) + tutup QUIC/UDP 443. Tanpa menutup QUIC,
 *   YouTube memakai jalurnya sendiri dan lolos dari penyaringan. */

export const KUNCI = {
  mode: "jaringan.ujianMode",           // MATI | OTOMATIS | PAKSA_AKTIF
  antarmuka: "jaringan.ujianAntarmuka", // daftar interface dipisah koma
  host: "jaringan.ujianHost",           // pola tls-host dipisah koma
  tenggang: "jaringan.ujianTenggang",   // menit setelah peserta terakhir selesai
} as const;

export const BAWAAN: Record<string, string> = {
  [KUNCI.mode]: "MATI",
  [KUNCI.antarmuka]: "vlan30_SISWA",
  [KUNCI.host]: "*youtube*,*googlevideo*,*tiktok*,*instagram*,*facebook*,*netflix*,*twitch*,*roblox*",
  [KUNCI.tenggang]: "10",
};

const AWALAN = "SMK-UJIAN";
export type ModeJaringan = "MATI" | "OTOMATIS" | "PAKSA_AKTIF";

export interface StatusJaringanUjian {
  mode: ModeJaringan;
  antarmuka: string[];
  host: string[];
  aturan: number;        // jumlah aturan milik kita di router
  aktif: boolean;        // aturan sedang menyala
  sedangUjian: number;   // jumlah peserta yang sedang mengerjakan
  routerOk: boolean;
  pesan?: string;
}

async function pengaturan() {
  const s = await getSettings(Object.values(KUNCI));
  const ambil = (k: string) => (s[k] ?? BAWAAN[k] ?? "").toString();
  return {
    mode: (ambil(KUNCI.mode) as ModeJaringan) || "MATI",
    antarmuka: ambil(KUNCI.antarmuka).split(",").map(x => x.trim()).filter(Boolean),
    host: ambil(KUNCI.host).split(",").map(x => x.trim()).filter(Boolean),
    tenggang: Math.max(0, Number(ambil(KUNCI.tenggang)) || 10),
  };
}

/** Jumlah peserta yang BENAR-BENAR sedang mengerjakan (termasuk masa tenggang setelah selesai). */
export async function pesertaSedangUjian(tenggangMenit = 10): Promise<number> {
  const batas = new Date(Date.now() - tenggangMenit * 60_000);
  return prisma.examAttempt.count({
    where: { submittedAt: null, lastSeenAt: { gt: batas }, exam: { title: { not: { startsWith: "UJI SISTEM" } } } },
  }).catch(() => 0);
}

/** Pastikan aturan milik kita ada di router (dibuat dalam keadaan MATI). Aman dipanggil berulang. */
export async function pastikanAturan(): Promise<number> {
  const { antarmuka, host } = await pengaturan();
  return withMikrotik(async conn => {
    const ada = (await conn.write("/ip/firewall/filter/print")) as MikrotikRow[];
    const punyaKita = ada.filter(r => (r.comment ?? "").startsWith(AWALAN));
    const perlu: { comment: string; args: string[] }[] = [];

    for (const iface of antarmuka) {
      const cQuic = `${AWALAN}: tutup QUIC ${iface}`;
      perlu.push({
        comment: cQuic,
        args: [
          "=chain=forward", "=action=drop", `=in-interface=${iface}`, "=protocol=udp", "=dst-port=443",
          "=disabled=yes", `=comment=${cQuic}`,
        ],
      });
      for (const h of host) {
        const c = `${AWALAN}: ${h} ${iface}`;
        perlu.push({
          comment: c,
          args: [
            "=chain=forward", "=action=drop", `=in-interface=${iface}`, "=protocol=tcp", "=dst-port=443",
            `=tls-host=${h}`, "=disabled=yes", `=comment=${c}`,
          ],
        });
      }
    }

    let dibuat = 0;
    for (const p of perlu) {
      if (punyaKita.some(r => r.comment === p.comment)) continue;
      await conn.write("/ip/firewall/filter/add", p.args);
      dibuat += 1;
    }
    // Aturan milik kita yang sudah tidak ada di daftar (mis. situs dihapus dari pengaturan) ikut dibersihkan.
    for (const r of punyaKita) {
      if (perlu.some(p => p.comment === r.comment)) continue;
      await conn.write("/ip/firewall/filter/remove", [`=.id=${r[".id"]}`]);
    }
    return dibuat;
  });
}

/** Nyalakan/matikan seluruh aturan milik kita. */
export async function setAktif(aktif: boolean): Promise<number> {
  return withMikrotik(async conn => {
    const ada = (await conn.write("/ip/firewall/filter/print")) as MikrotikRow[];
    const punyaKita = ada.filter(r => (r.comment ?? "").startsWith(AWALAN));
    let diubah = 0;
    for (const r of punyaKita) {
      const sedangMati = r.disabled === "true";
      if (sedangMati === !aktif) continue;
      await conn.write("/ip/firewall/filter/set", [`=.id=${r[".id"]}`, `=disabled=${aktif ? "no" : "yes"}`]);
      diubah += 1;
    }
    return diubah;
  });
}

export async function statusJaringanUjian(): Promise<StatusJaringanUjian> {
  const p = await pengaturan();
  const sedangUjian = await pesertaSedangUjian(p.tenggang);
  try {
    const { jumlah, aktif } = await withMikrotik(async conn => {
      const ada = (await conn.write("/ip/firewall/filter/print")) as MikrotikRow[];
      const punyaKita = ada.filter(r => (r.comment ?? "").startsWith(AWALAN));
      return { jumlah: punyaKita.length, aktif: punyaKita.length > 0 && punyaKita.every(r => r.disabled !== "true") };
    });
    return { mode: p.mode, antarmuka: p.antarmuka, host: p.host, aturan: jumlah, aktif, sedangUjian, routerOk: true };
  } catch (e) {
    return {
      mode: p.mode, antarmuka: p.antarmuka, host: p.host, aturan: 0, aktif: false, sedangUjian,
      routerOk: false, pesan: e instanceof Error ? e.message : "Router tidak terjangkau",
    };
  }
}

/** Dipanggil penjadwal: samakan keadaan router dengan mode + ada/tidaknya pengerjaan ujian. */
export async function sinkronModeUjian(): Promise<{ target: boolean; diubah: number }> {
  const p = await pengaturan();
  if (p.mode === "MATI") {
    // Tetap pastikan aturan padam supaya tidak ada sisa blokir menggantung setelah fitur dimatikan.
    const diubah = await setAktif(false).catch(() => 0);
    return { target: false, diubah };
  }
  const target = p.mode === "PAKSA_AKTIF" || (await pesertaSedangUjian(p.tenggang)) > 0;
  const diubah = await setAktif(target).catch(() => 0);
  return { target, diubah };
}
