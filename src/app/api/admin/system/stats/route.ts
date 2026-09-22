import { NextResponse } from "next/server";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, readdir } from "fs/promises";
import { verifyRole } from "@/lib/dal";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

/* PERFORMA SERVER = KONTAINER LXC SITUS INI SAJA (aplikasi web, database, OnlyOffice, dan proses sistem
 * di dalamnya) — BUKAN seluruh mesin Proxmox.
 *
 * Dulu CPU dihitung dari os.loadavg() dibagi jumlah core. Di dalam Docker, loadavg itu milik SELURUH host
 * Proxmox (termasuk VM lain), sehingga halaman menampilkan "CPU 244%" padahal situs hampir diam; RAM-nya
 * malah hanya kontainer aplikasi (lxcfs menghitung per pemanggil). Temuan user 14 September 2026.
 *
 * Sekarang semua angka dibaca dari cgroup v2 milik LXC, di-mount read-only ke /host/cgroup (lihat
 * docker-compose.yml), dan /proc milik LXC di /host/proc:
 *   - CPU      : selisih cpu.stat usage_usec antar-pembacaan ÷ jatah CPU kontainer
 *   - Tekanan  : cpu.pressure — persen waktu ada proses situs yang TERPAKSA MENUNGGU CPU (host sibuk)
 *   - RAM      : memory.current dikurangi cache berkas & slab yang bisa dilepas (setara "used" pada `free`)
 *   - Layanan  : cgroup tiap kontainer Docker; namanya dikenali dari proses di dalamnya lewat /host/proc
 */
const CG = "/host/cgroup";
const PROC = "/host/proc";
const GiB = 1024 ** 3;

interface DiskInfo { sizeGb: number; usedGb: number; availGb: number; pct: number }
type Sampel = { t: number; total: number; perScope: Record<string, number> };

/** Sampel CPU terakhir, disimpan di memori proses: halaman memanggil route ini tiap 15 detik. */
let sampelLama: Sampel | null = null;
/** Peta scope Docker → nama layanan; jarang berubah, disegarkan tiap 5 menit. */
let petaLama: { t: number; peta: Record<string, string> } | null = null;

const bacaTeks = (p: string) => readFile(p, "utf-8");
const bulat1 = (n: number) => Math.round(n * 10) / 10;

function nilaiStat(raw: string, kunci: string): number {
  const m = raw.match(new RegExp(`^${kunci} (\\d+)`, "m"));
  return m ? Number(m[1]) : 0;
}

async function getDisk(): Promise<DiskInfo | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", "/"]);
    const parts = stdout.trim().split("\n")[1].trim().split(/\s+/);
    const [sizeKb, usedKb, availKb] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    return {
      sizeGb: bulat1(sizeKb / 1024 / 1024), usedGb: bulat1(usedKb / 1024 / 1024),
      availGb: bulat1(availKb / 1024 / 1024), pct: Number(parts[4].replace("%", "")),
    };
  } catch {
    return null;
  }
}

/** Jatah CPU kontainer: kuota cpu.max kalau dibatasi, selain itu jumlah CPU di cpuset. */
async function jatahCpu(): Promise<number> {
  try {
    const [kuota, periode] = (await bacaTeks(`${CG}/cpu.max`)).trim().split(/\s+/);
    if (kuota !== "max") return Math.max(0.01, Number(kuota) / Number(periode));
  } catch { /* lanjut */ }
  try {
    const n = (await bacaTeks(`${CG}/cpuset.cpus.effective`)).trim().split(",").filter(Boolean)
      .reduce((jml, bagian) => { const [a, b] = bagian.split("-").map(Number); return jml + (Number.isFinite(b) ? b - a + 1 : 1); }, 0);
    if (n > 0) return n;
  } catch { /* lanjut */ }
  return os.cpus().length;
}

/** Layanan dikenali dari nama proses. cgroup.procs tidak bisa dipakai: dari dalam kontainer aplikasi,
 * PID kontainer lain terbaca 0 (beda PID namespace) — yang terlihat utuh hanya /proc milik LXC. */
function namaLayanan(namaProses: string): string {
  if (/next-server|node/.test(namaProses)) return "Aplikasi web";
  if (/postgres/.test(namaProses)) return "Database";
  if (/docservice|converter|documentserver|supervisord|run-document/.test(namaProses)) return "OnlyOffice";
  return "Layanan lain";
}

async function petaScope(): Promise<Record<string, string>> {
  if (petaLama && Date.now() - petaLama.t < 5 * 60_000) return petaLama.peta;
  const proses: Record<string, string[]> = {};
  const pids = (await readdir(PROC)).filter(n => /^\d+$/.test(n));
  await Promise.all(pids.map(async pid => {
    try {
      const cg = (await bacaTeks(`${PROC}/${pid}/cgroup`)).trim();
      const m = cg.match(/(docker-[0-9a-f]+\.scope)/);
      if (!m) return;
      const comm = (await bacaTeks(`${PROC}/${pid}/comm`)).trim();
      (proses[m[1]] ??= []).push(comm);
    } catch { /* proses sudah selesai */ }
  }));
  const peta: Record<string, string> = {};
  for (const [scope, nama] of Object.entries(proses)) peta[scope] = namaLayanan(nama.join(" "));
  // Proses kontainer aplikasi SENDIRI terbaca "0::/" (akar cgroup namespace-nya), jadi tidak punya
  // nama scope di atas. Kenali lewat hostname Docker = awalan ID kontainer yang ada di nama scope.
  const sendiri = os.hostname();
  for (const scope of await scopeDocker()) if (!peta[scope] && /^[0-9a-f]{12}$/.test(sendiri) && scope.includes(sendiri)) peta[scope] = "Aplikasi web";
  petaLama = { t: Date.now(), peta };
  return peta;
}

async function scopeDocker(): Promise<string[]> {
  try {
    return (await readdir(`${CG}/system.slice`)).filter(d => d.startsWith("docker-") && d.endsWith(".scope"));
  } catch {
    return [];
  }
}

async function ambilSampel(scopes: string[]): Promise<Sampel> {
  const total = nilaiStat(await bacaTeks(`${CG}/cpu.stat`), "usage_usec");
  const perScope: Record<string, number> = {};
  await Promise.all(scopes.map(async s => {
    perScope[s] = nilaiStat(await bacaTeks(`${CG}/system.slice/${s}/cpu.stat`).catch(() => ""), "usage_usec");
  }));
  return { t: Date.now(), total, perScope };
}

/** RAM terpakai tanpa cache berkas & slab yang bisa dilepas kernel kapan saja. */
async function memoriTerpakai(dir: string): Promise<number> {
  const current = Number((await bacaTeks(`${dir}/memory.current`)).trim());
  const stat = await bacaTeks(`${dir}/memory.stat`);
  const lepas = nilaiStat(stat, "inactive_file") + nilaiStat(stat, "active_file") + nilaiStat(stat, "slab_reclaimable");
  return Math.max(nilaiStat(stat, "anon"), current - lepas);
}

async function batasMemori(): Promise<number> {
  try {
    const max = (await bacaTeks(`${CG}/memory.max`)).trim();
    if (max !== "max") return Number(max);
  } catch { /* lanjut */ }
  // Batas LXC dipasang di cgroup induk (di host) — lxcfs menampilkannya sebagai MemTotal.
  try {
    const m = (await bacaTeks(`${PROC}/meminfo`)).match(/^MemTotal:\s+(\d+)/m);
    if (m) return Number(m[1]) * 1024;
  } catch { /* lanjut */ }
  return os.totalmem();
}

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);

    const scopes = await scopeDocker();
    const [jatah, disk, peta, totalMem] = await Promise.all([jatahCpu(), getDisk(), petaScope().catch(() => ({} as Record<string, string>)), batasMemori()]);

    // CPU butuh dua pembacaan. Pembacaan pertama (atau yang terlalu lama) diambil ulang dengan jeda 1 detik.
    let lama = sampelLama;
    if (!lama || Date.now() - lama.t > 5 * 60_000) {
      lama = await ambilSampel(scopes);
      await new Promise(r => setTimeout(r, 1000));
    }
    const baru = await ambilSampel(scopes);
    sampelLama = baru;
    const dtUsec = Math.max(1, (baru.t - lama.t) * 1000);
    const coreDari = (sekarang: number, sebelum: number) => Math.max(0, sekarang - sebelum) / dtUsec;

    const coreTotal = coreDari(baru.total, lama.total);
    const usedMem = await memoriTerpakai(CG);

    // Rincian per layanan (kontainer Docker dengan nama sama digabung), sisanya = proses di luar Docker.
    const perLayanan = new Map<string, { core: number; memBytes: number }>();
    await Promise.all(scopes.map(async s => {
      const nama = peta[s] ?? "Layanan lain";
      const core = coreDari(baru.perScope[s] ?? 0, lama!.perScope[s] ?? baru.perScope[s] ?? 0);
      const memBytes = await memoriTerpakai(`${CG}/system.slice/${s}`).catch(() => 0);
      const ada = perLayanan.get(nama) ?? { core: 0, memBytes: 0 };
      perLayanan.set(nama, { core: ada.core + core, memBytes: ada.memBytes + memBytes });
    }));
    const sumCore = [...perLayanan.values()].reduce((n, l) => n + l.core, 0);
    const sumMem = [...perLayanan.values()].reduce((n, l) => n + l.memBytes, 0);
    const layanan = [...perLayanan.entries()].map(([label, l]) => ({ label, core: l.core, memBytes: l.memBytes }));
    layanan.push({ label: "Sistem & proses lain", core: Math.max(0, coreTotal - sumCore), memBytes: Math.max(0, usedMem - sumMem) });

    const tekananRaw = await bacaTeks(`${CG}/cpu.pressure`).catch(() => "");
    const tekanan = (k: string) => Number(tekananRaw.match(new RegExp(`^some .*${k}=([\\d.]+)`, "m"))?.[1] ?? 0);

    return NextResponse.json({
      lingkup: "kontainer",
      memory: {
        totalGb: bulat1(totalMem / GiB),
        usedGb: bulat1(usedMem / GiB),
        freeGb: bulat1(Math.max(0, totalMem - usedMem) / GiB),
        pct: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        jatahCore: bulat1(jatah),
        coreDipakai: Math.round(coreTotal * 100) / 100,
        pct: Math.round((coreTotal / jatah) * 100),
        model: os.cpus()[0]?.model?.trim() ?? "—",
        tekanan: { avg10: tekanan("avg10"), avg60: tekanan("avg60"), avg300: tekanan("avg300") },
      },
      layanan: layanan
        .map(l => ({ label: l.label, coreDipakai: Math.round(l.core * 100) / 100, pctJatah: Math.round((l.core / jatah) * 1000) / 10, memMb: Math.round(l.memBytes / 1024 / 1024) }))
        .sort((a, b) => b.memMb - a.memMb),
      disk,
      uptimeHours: bulat1(os.uptime() / 3600),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Gagal membaca pemakaian kontainer. Pastikan /sys/fs/cgroup ter-mount ke /host/cgroup." }, { status: 500 });
  }
}
