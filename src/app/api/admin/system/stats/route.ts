import { NextResponse } from "next/server";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { verifyRole } from "@/lib/dal";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

interface DiskInfo { sizeGb: number; usedGb: number; availGb: number; pct: number }
interface MemInfo { totalBytes: number; freeBytes: number }

async function getDisk(): Promise<DiskInfo | null> {
  try {
    // --output kolom dalam satuan 1K-blocks; dikonversi ke GB di sini.
    const { stdout } = await execFileAsync("df", ["-Pk", "/"]);
    const line = stdout.trim().split("\n")[1];
    const parts = line.trim().split(/\s+/);
    const sizeKb = Number(parts[1]);
    const usedKb = Number(parts[2]);
    const availKb = Number(parts[3]);
    const pct = Number(parts[4].replace("%", ""));
    return {
      sizeGb: Math.round((sizeKb / 1024 / 1024) * 10) / 10,
      usedGb: Math.round((usedKb / 1024 / 1024) * 10) / 10,
      availGb: Math.round((availKb / 1024 / 1024) * 10) / 10,
      pct,
    };
  } catch {
    return null;
  }
}

// Server ini jalan di LXC Proxmox (dijatah RAM/CPU terbatas oleh host, lihat "Container ... on
// node" di Proxmox) — LXC memvirtualisasi /proc/meminfo lewat lxcfs supaya proses DI DALAM LXC
// baca jatah LXC (mis. 8GB), bukan RAM fisik mesin Proxmox (mis. 32GB). TAPI virtualisasi lxcfs
// itu cuma berlaku di mount /proc milik LXC itu sendiri — container Docker kita dapat /proc BARU
// (dari container runtime) yang TIDAK lewat lxcfs, jadi baca RAM FISIK HOST Proxmox yang salah
// (terverifikasi: `nproc`/loadavg/disk sudah benar ikut LXC, cuma /proc/meminfo yang salah).
// Makanya /proc host di-mount read-only ke /host/proc (lihat docker-compose.yml) supaya bisa baca
// /host/proc/meminfo yang benar (lewat lxcfs, sudah dijatah Proxmox). Fallback ke os.totalmem()
// kalau mount itu tidak ada (mis. saat dev lokal tanpa Docker/LXC).
async function getMemInfo(): Promise<MemInfo> {
  try {
    const raw = await readFile("/host/proc/meminfo", "utf-8");
    const get = (key: string) => {
      const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return m ? Number(m[1]) * 1024 : null; // kB -> bytes
    };
    const totalBytes = get("MemTotal");
    const availableBytes = get("MemAvailable") ?? get("MemFree");
    if (totalBytes && availableBytes !== null) {
      return { totalBytes, freeBytes: availableBytes };
    }
  } catch {
    // /host/proc tidak ter-mount — pakai fallback di bawah.
  }
  return { totalBytes: os.totalmem(), freeBytes: os.freemem() };
}

// `nproc` menghormati batas cpuset cgroup (jatah LXC) — beda dari os.cpus().length yang cuma
// menghitung baris /proc/cpuinfo (selalu jumlah core FISIK host, tidak peduli jatah cgroup).
async function getCpuCores(): Promise<number> {
  try {
    const { stdout } = await execFileAsync("nproc");
    const n = parseInt(stdout.trim(), 10);
    if (n > 0) return n;
  } catch {
    // fallback di bawah
  }
  return os.cpus().length;
}

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);

    const [{ totalBytes: totalMemBytes, freeBytes: freeMemBytes }, cores, disk] = await Promise.all([
      getMemInfo(),
      getCpuCores(),
      getDisk(),
    ]);
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const [load1, load5, load15] = os.loadavg();
    const cpuModel = os.cpus()[0]?.model?.trim() ?? "—";

    return NextResponse.json({
      memory: {
        totalGb: Math.round((totalMemBytes / 1024 ** 3) * 10) / 10,
        usedGb: Math.round((usedMemBytes / 1024 ** 3) * 10) / 10,
        freeGb: Math.round((freeMemBytes / 1024 ** 3) * 10) / 10,
        pct: Math.round((usedMemBytes / totalMemBytes) * 100),
      },
      cpu: {
        cores,
        model: cpuModel,
        loadAvg: [load1, load5, load15].map(n => Math.round(n * 100) / 100),
        // Load average dibagi jumlah core supaya jadi persentase yang mudah dibaca (>100% = server kewalahan).
        loadPct1: Math.round((load1 / cores) * 100),
      },
      disk,
      uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
