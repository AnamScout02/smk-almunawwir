import "server-only";
import { prisma } from "@/lib/prisma";
import { modeBelBerlaku } from "@/lib/bel-profil";
import { type MikrotikRow } from "@/lib/mikrotik";
import { bacaRouter, cekJangkauan, detik, mungkinMacAcak, rapikanMac, type DataRouter } from "@/lib/router-perangkat";

// Dipakai juga oleh rute API layar (peringatan MAC acak saat mendaftarkan TV).
export { mungkinMacAcak };

/** PEMANTAUAN LAYAR/TV SEKOLAH (24 September 2026) — permintaan user: TV kelas banyak, Sarpras perlu tahu
 * mana yang hidup dan dipakai apa, TANPA mengunci TV (TV tetap alat mengajar serbaguna).
 *
 * Versi pertama ini SENGAJA tidak menuntut aplikasi terpasang di TV: seluruh statusnya dibaca dari MikroTik
 * (sewa DHCP + tabel hotspot), dicocokkan ke baris `Layar` lewat MAC. Yang belum bisa dijawab router —
 * aplikasi apa yang sedang dibuka, sisa memori — menyusul saat aplikasi pemantau di TV dipasang.
 *
 * Catatan penting soal MAC: Android (termasuk Google TV) MENGACAK MAC per jaringan WiFi. MAC acak selalu
 * punya bit "locally administered" menyala (angka kedua: 2, 6, A, atau E), dan akan berubah lagi setelah
 * TV lupa-sambung ulang — binding/sewa statis yang memakainya diam-diam berhenti berlaku. Karena itu
 * `mungkinMacAcak` menandainya supaya petugas diminta mematikan MAC acak di TV lebih dulu. */

export interface BarisLayar {
  id: string; nama: string; ruang: string; mac: string; aktif: boolean;
  ip: string | null; jaringan: string | null;
  status: "ONLINE" | "OFFLINE" | "BELUM_LOGIN";
  terlihatDetikLalu: number | null;
  diamDetik: number | null; // lama tidak ada lalu lintas — TV menyala tapi tidak dipakai
  trafikMb: number | null; // data terpakai sejak tersambung, penanda kasar "sedang dipakai"
  nyalaDetik: number | null; // sudah berapa lama tersambung jaringan
  macAcak: boolean;
  catatan: string | null;
  jadwalMati: string | null;
  jadwalNyala: string | null;
  token: string | null;
  kelasId: string | null;
  papanJudul: string | null;
  papanIsi: string | null;
  papanOtomatis: boolean;
  papanQr: string;
  papanJenis: string;
  papanGiliran: number;
  volumeBel: number | null;
  /** Mode Bel yang BERLAKU sekarang (sudah memperhitungkan batas waktunya) + batasnya untuk ditampilkan. */
  belMode: string; belModeSampai: string | null;
  papanCara: string;
  ipTetap: string | null;
  perangkatModel: string | null; aplikasiDepan: string | null; terakhirDenyut: Date | null;
}

/** Perangkat yang terlihat router tapi belum terdaftar sebagai layar — bahan tombol "Daftarkan TV". */
export interface KandidatPerangkat {
  mac: string; ip: string; namaHost: string | null; jaringan: string | null;
  sistem: string | null; macAcak: boolean; mungkinTv: boolean; barusanMuncul: boolean;
}

/** Daftar layar terdaftar + statusnya sekarang. Router tidak terjangkau → status OFFLINE, halaman tetap tampil. */
export async function daftarLayar(): Promise<{ baris: BarisLayar[]; routerOk: boolean }> {
  const layar = await prisma.layar.findMany({ orderBy: [{ aktif: "desc" }, { ruang: "asc" }, { nama: "asc" }] });
  let data: DataRouter | null = null;
  try { data = await bacaRouter(); } catch { data = null; }

  /* SATU MAC BISA PUNYA BEBERAPA ALAMAT, DAN YANG PALING BARU BELUM TENTU YANG HIDUP.
     TV Lab DPIB punya dua sewa `bound` sekaligus: 172.16.1.28 (terlihat 30 menit lalu) dan 172.17.0.92
     (5 menit lalu) — dan justru yang LEBIH BARU tidak menjawab ping maupun ADB, sementara yang lebih lama
     bekerja penuh (dibuktikan 25 Sep 2026 dengan menekan tombol Beranda lewat .28). Karena itu patokannya
     bukan kebaruan dan bukan urutan pembacaan, melainkan ALAMAT MANA YANG BENAR-BENAR MENJAWAB.
     Semua kandidat dikumpulkan lalu diuji sekaligus; yang menjawab dipakai, dan kalau tidak ada yang menjawab
     barulah dipakai yang paling baru terlihat sebagai tebakan terbaik. */
  const semuaSewa = new Map<string, MikrotikRow[]>();
  for (const s of data?.sewa ?? []) {
    if (!s["mac-address"]) continue;
    const k = rapikanMac(s["mac-address"]);
    (semuaSewa.get(k) ?? semuaSewa.set(k, []).get(k)!).push(s);
  }
  const semuaHost = new Map<string, MikrotikRow[]>();
  for (const h of data?.hostHotspot ?? []) {
    if (!h["mac-address"]) continue;
    const k = rapikanMac(h["mac-address"]);
    (semuaHost.get(k) ?? semuaHost.set(k, []).get(k)!).push(h);
  }
  const urutBaru = (a: MikrotikRow, b: MikrotikRow) =>
    (detik(a["last-seen"]) ?? Number.MAX_SAFE_INTEGER) - (detik(b["last-seen"]) ?? Number.MAX_SAFE_INTEGER);
  const petaSewa = new Map<string, MikrotikRow>();
  for (const [k, v] of semuaSewa) petaSewa.set(k, [...v].sort(urutBaru)[0]);
  const petaHost = new Map<string, MikrotikRow>();
  for (const [k, v] of semuaHost) petaHost.set(k, [...v].sort(urutBaru)[0]);

  /* PEMILIK ALAMAT SAAT INI (4 Okt 2026, laporan user: "ip TV Ruang B3 dan lab dkv sama"). DHCP memberikan
     alamat lama TV yang sedang mati ke TV lain; alamat itu tetap MENJAWAB, sehingga TV yang mati ikut tampil
     menyala memakai alamat milik TV lain — dan perintah ADB untuknya (tangkapan layar, daya, buka papan, volume
     bel) nyasar ke TV yang salah. Patokan pemilik = tabel ARP + host hotspot (peta alamat→MAC yang sedang
     berlaku), BUKAN daftar sewa yang bisa menyimpan sewa basi. Alamat milik MAC lain dibuang dari calon. */
  const pemilikIp = new Map<string, string>();
  for (const r of [...(data?.arp ?? []), ...(data?.hostHotspot ?? [])]) {
    if (r.address && r["mac-address"]) pemilikIp.set(r.address, rapikanMac(r["mac-address"]));
  }
  const milikLain = (alamat: string, mac: string) => { const p = pemilikIp.get(alamat); return !!p && p !== mac; };

  /** Semua alamat yang mungkin untuk satu layar, sudah diurutkan dari yang paling menjanjikan. */
  const kandidatAlamat = (l: { mac: string; ipTetap: string | null; ipTerakhir: string | null }) => {
    const k = rapikanMac(l.mac);
    const dari = [
      ...[...(semuaSewa.get(k) ?? [])].sort(urutBaru).flatMap(x => [x["active-address"], x.address]),
      ...[...(semuaHost.get(k) ?? [])].sort(urutBaru).map(x => x.address),
      l.ipTerakhir,
    ].filter((x): x is string => !!x && !milikLain(x, k));
    // IP tetap ditetapkan petugas — selalu menang dan tidak disaring.
    return [...new Set([l.ipTetap, ...dari].filter((x): x is string => !!x))];
  };

  const sudahLogin = new Set((data?.aktifHotspot ?? []).map(a => rapikanMac(a["mac-address"] ?? "")));

  // SEMUA kandidat diuji, bukan satu tebakan — itulah satu-satunya cara memisahkan alamat hidup dari sewa mati.
  const perluCek = layar.filter(l => l.aktif).flatMap(kandidatAlamat);
  const hasilCek = await cekJangkauan([...new Set(perluCek)]);

  const baris = layar.map<BarisLayar>(l => {
    const mac = rapikanMac(l.mac);
    const s = petaSewa.get(mac);
    const h = petaHost.get(mac);
    const terlihat = detik(s?.["last-seen"]);
    const kandidat = kandidatAlamat(l);
    const menjawab = kandidat.find(a => hasilCek.get(a) === true);
    const alamat = menjawab ?? kandidat[0] ?? null;
    const hidup = !!menjawab || (!!h && kandidat.includes(h.address ?? ""));
    // Perangkat hotspot punya DUA cara sah untuk berinternet: login (authorized) atau DILEWATKAN lewat IP binding
    // (bypassed). TV sekolah memakai yang kedua supaya tidak perlu login tiap kali menyala — jadi `authorized:false`
    // pada perangkat ber-bypass BUKAN berarti bermasalah (temuan user 24 Sep 2026: TV Lab TKJ tertulis "belum login"
    // padahal internetnya jalan penuh). BELUM_LOGIN hanya untuk yang tidak keduanya: terlihat router, tanpa internet.
    const dilewatkan = h?.bypassed === "true";
    const sudahMasuk = h?.authorized === "true" || sudahLogin.has(mac);
    const belumLogin = !!h && !dilewatkan && !sudahMasuk;
    return {
      id: l.id, nama: l.nama, ruang: l.ruang, mac, aktif: l.aktif,
      ip: alamat,
      jaringan: s?.["active-server"] ?? h?.server ?? l.jaringan ?? null,
      status: !hidup ? "OFFLINE" : belumLogin ? "BELUM_LOGIN" : "ONLINE",
      terlihatDetikLalu: terlihat,
      diamDetik: detik(h?.["idle-time"]),
      trafikMb: h ? Math.round((Number(h["bytes-in"] ?? 0) + Number(h["bytes-out"] ?? 0)) / 104857.6) / 10 : null,
      nyalaDetik: detik(h?.uptime),
      macAcak: mungkinMacAcak(mac),
      catatan: l.catatan, jadwalMati: l.jadwalMati, jadwalNyala: l.jadwalNyala, token: l.token, kelasId: l.kelasId, papanJudul: l.papanJudul, papanIsi: l.papanIsi, papanOtomatis: l.papanOtomatis, papanQr: l.papanQr, papanJenis: l.papanJenis, papanGiliran: l.papanGiliran, volumeBel: l.volumeBel, papanCara: l.papanCara, ipTetap: l.ipTetap,
      belMode: modeBelBerlaku(l), belModeSampai: modeBelBerlaku(l) === "NORMAL" ? null : l.belModeSampai?.toISOString() ?? null,
      perangkatModel: l.perangkatModel, aplikasiDepan: l.aplikasiDepan, terakhirDenyut: l.terakhirDenyut,
    };
  });
  // Simpan IP & jaringan terakhir yang terlihat: rute ADB (tangkapan layar, tombol) memerlukannya, dan
  // TV yang sedang mati tetap punya alamat terakhir untuk dicoba begitu ia menyala lagi.
  if (data) {
    // Alamat simpanan yang kini dipakai perangkat lain DIHAPUS — rute ADB memakai `ipTetap || ipTerakhir` langsung,
    // jadi alamat basi di sini berarti perintah dikirim ke TV yang salah.
    const basi = layar.filter(l => l.ipTerakhir && milikLain(l.ipTerakhir, rapikanMac(l.mac)));
    if (basi.length) {
      await Promise.all(basi.map(l => prisma.layar.update({ where: { id: l.id }, data: { ipTerakhir: null } }).catch(() => null)));
    }
    const perlu = baris.filter((b, i) => b.ip && b.ip !== layar[i].ipTetap && (b.ip !== layar[i].ipTerakhir || b.jaringan !== layar[i].jaringan));
    if (perlu.length) {
      await Promise.all(perlu.map(b => prisma.layar.update({
        where: { id: b.id }, data: { ipTerakhir: b.ip, jaringan: b.jaringan },
      }).catch(() => null)));
    }
  }
  return { baris, routerOk: data !== null };
}

/** Perangkat yang belum terdaftar. Ditandai `mungkinTv` bila cirinya khas Android TV:
 * sistemnya Android TAPI tidak mengirim nama host (HP hampir selalu mengirim nama, TV jarang). */
export async function kandidatPerangkat(): Promise<KandidatPerangkat[]> {
  const [layar, data] = await Promise.all([
    prisma.layar.findMany({ select: { mac: true } }),
    bacaRouter().catch(() => null),
  ]);
  if (!data) return [];
  const sudah = new Set(layar.map(l => rapikanMac(l.mac)));
  return data.sewa
    .filter(s => s.status === "bound" && s["mac-address"] && !sudah.has(rapikanMac(s["mac-address"])))
    .map(s => {
      const sistem = s["class-id"] ?? null;
      const namaHost = s["host-name"] || null;
      // Catatan: kolom `age` HANYA ada di CLI (`print detail`), tidak dikirim lewat API RouterOS —
      // jadi "baru terlihat" dihitung dari `last-seen` (aktivitas terakhir), bukan umur sewanya.
      const terlihat = detik(s["last-seen"]);
      return {
        mac: rapikanMac(s["mac-address"]),
        ip: s["active-address"] ?? s.address ?? "",
        namaHost,
        jaringan: s["active-server"] ?? s.server ?? null,
        sistem,
        macAcak: mungkinMacAcak(s["mac-address"]),
        mungkinTv: !!sistem?.startsWith("android") && !namaHost,
        barusanMuncul: terlihat !== null && terlihat < 120,
      };
    })
    .sort((a, b) => Number(b.mungkinTv) - Number(a.mungkinTv) || Number(b.barusanMuncul) - Number(a.barusanMuncul));
}
