/** PEMECAH JADWAL (11 Oktober 2026) — murni, tanpa database, supaya bisa diuji di luar server.
 *
 *  Pembangkit lama (`/api/admin/schedules/generate`) bersifat "rakus": mengisi slot kosong satu per satu, dan bila tidak
 *  ada slot kosong yang cocok ia menyerah ("belum terjadwal"). Pemecah ini mencari dengan RANTAI GESER: untuk menaruh satu
 *  jam, ia boleh memindahkan pelajaran lain yang menghalangi ke tempat lain — dan pelajaran itu boleh menggeser yang
 *  lain lagi — sampai kedalaman tertentu, dengan lacak-balik bila buntu. Itulah yang dilakukan penyusun jadwal manusia
 *  ("pindahkan Matematika X TKJ 1 ke Kamis jam 5 supaya Bahasa Inggris masuk Selasa jam 3").
 *
 *  Aturan yang dijaga (sama dengan pembangkit lama & Pemeriksa Jadwal):
 *   - satu kelas satu pelajaran per jam; minggu A dan B tidak saling bentrok, "SEMUA" bentrok dengan keduanya;
 *   - satu guru satu kelas per jam, KECUALI mapel yang sama sampai `maxShared` kelas (mis. PJOK dua kelas sekaligus);
 *   - jam yang dipatok lewat Preferensi Hari/Jam tidak pernah digeser;
 *   - kelas rotasi (X & XI) boleh memakai minggu A atau B (minggu utamanya didahulukan), kelas lain hanya "SEMUA".
 *  Hasilnya USULAN berupa daftar langkah — tidak ada yang ditulis ke jadwal dari berkas ini. */

export type Minggu = "A" | "B" | "SEMUA";
export interface Sel {
  id: string; rowId: string | null; classId: string; teacherId: string | null; subject: string;
  week: Minggu; day: number; pi: number; tetap: boolean; maxShared: number; rotasi: boolean;
}
export interface Kebutuhan { classId: string; teacherId: string; subject: string; maxShared: number; rotasi: boolean; mingguUtama: Minggu }
export interface Langkah { jenis: "BARU" | "PINDAH"; sel: Sel; dari: { week: Minggu; day: number; pi: number } | null; ke: { week: Minggu; day: number; pi: number } }

const lapis = (w: Minggu) => (w === "A" ? [0] : w === "B" ? [1] : [0, 1]);

export class PapanJadwal {
  private kelas = new Map<string, Set<string>>();
  private guru = new Map<string, Set<string>>();
  readonly sel = new Map<string, Sel>();
  private urut = 0;
  /** jamPerHari[day] = jumlah jam pelajaran (bukan istirahat) hari itu. */
  constructor(readonly jamPerHari: number[]) {}

  private kk = (c: string, l: number, d: number, p: number) => `${c}|${l}|${d}|${p}`;
  pasang(s: Sel) {
    this.sel.set(s.id, s);
    for (const l of lapis(s.week)) {
      const a = this.kk(s.classId, l, s.day, s.pi); this.kelas.set(a, (this.kelas.get(a) ?? new Set()).add(s.id));
      if (s.teacherId) { const g = this.kk(s.teacherId, l, s.day, s.pi); this.guru.set(g, (this.guru.get(g) ?? new Set()).add(s.id)); }
    }
  }
  cabut(s: Sel) {
    this.sel.delete(s.id);
    for (const l of lapis(s.week)) {
      this.kelas.get(this.kk(s.classId, l, s.day, s.pi))?.delete(s.id);
      if (s.teacherId) this.guru.get(this.kk(s.teacherId, l, s.day, s.pi))?.delete(s.id);
    }
  }
  idBaru() { return `baru-${++this.urut}`; }

  /** Sel yang menghalangi `k` ditaruh di (week, day, pi): penghuni kelas itu + bentrok guru yang tidak diizinkan. */
  penghalang(k: { classId: string; teacherId: string | null; subject: string; maxShared: number }, week: Minggu, day: number, pi: number, abaikan?: string): Sel[] {
    const hasil = new Map<string, Sel>();
    for (const l of lapis(week)) {
      for (const id of this.kelas.get(this.kk(k.classId, l, day, pi)) ?? []) if (id !== abaikan) hasil.set(id, this.sel.get(id)!);
      if (!k.teacherId) continue;
      const lain = [...(this.guru.get(this.kk(k.teacherId, l, day, pi)) ?? [])].filter(id => id !== abaikan).map(id => this.sel.get(id)!).filter(x => x.classId !== k.classId);
      if (!lain.length) continue;
      const kelasLain = new Set(lain.map(x => x.classId));
      // Rangkap diizinkan: semua pelajaran yang berbarengan mapelnya sama dan jumlah kelasnya (termasuk kelas ini) ≤ maxShared.
      if (lain.every(x => x.subject === k.subject) && kelasLain.size + 1 <= k.maxShared) continue;
      for (const x of lain) hasil.set(x.id, x);
    }
    return [...hasil.values()];
  }

  /** Nilai sebuah tempat untuk `k`: menempel pada jam mapel yang sama (blok utuh) lebih baik daripada terserak. */
  nilai(k: { classId: string; subject: string }, week: Minggu, day: number, pi: number, abaikan?: string): number {
    let n = 0;
    for (const l of lapis(week)) {
      for (const d of [-1, 1]) for (const id of this.kelas.get(this.kk(k.classId, l, day, pi + d)) ?? []) if (id !== abaikan && this.sel.get(id)!.subject === k.subject) n += 3;
      for (let p = 0; p < (this.jamPerHari[day] ?? 0); p++) for (const id of this.kelas.get(this.kk(k.classId, l, day, p)) ?? []) if (id !== abaikan && this.sel.get(id)!.subject === k.subject) { n += 1; break; }
    }
    return n;
  }

  /** Jumlah jam di mana satu kelas memuat lebih dari satu pelajaran pada minggu yang sama (harus 0 pada hasil yang sah). */
  tabrakanKelas(): number {
    let n = 0;
    for (const v of this.kelas.values()) if (v.size > 1) n++;
    return n;
  }

  /** Semua bentrok guru yang TIDAK diizinkan pada jadwal sekarang (sepasang sel per temuan, tiap pasangan sekali). */
  bentrok(): [Sel, Sel][] {
    const hasil: [Sel, Sel][] = [], lihat = new Set<string>();
    for (const s of this.sel.values()) {
      for (const x of this.penghalang(s, s.week, s.day, s.pi, s.id)) {
        if (x.classId === s.classId) continue;
        const k = [s.id, x.id].sort().join("|");
        if (!lihat.has(k)) { lihat.add(k); hasil.push([s, x]); }
      }
    }
    return hasil;
  }
}

export interface OpsiCari { kedalaman: number; anggaran: number }

/** Taruh `sel` (baru, atau yang sedang dipindah) di tempat tanpa penghalang; bila tidak ada dan `kedalaman` masih
 *  tersisa, geser penghalangnya dulu. Mengembalikan daftar langkah (sudah DITERAPKAN ke papan) atau null (papan
 *  dikembalikan seperti semula). `asal` = tempat lama sel yang dipindah — tidak boleh dipilih lagi. */
export function carikanTempat(papan: PapanJadwal, sel: Sel, opsi: OpsiCari, hitung: { n: number }, tabu: Set<string>, asal: { week: Minggu; day: number; pi: number } | null, mingguUtama: Minggu): Langkah[] | null {
  const minggu: Minggu[] = sel.rotasi ? (mingguUtama === "B" ? ["B", "A"] : ["A", "B"]) : ["SEMUA"];
  type Calon = { week: Minggu; day: number; pi: number; halang: Sel[]; skor: number };
  const calon: Calon[] = [];
  minggu.forEach((week, iw) => {
    for (let day = 0; day < papan.jamPerHari.length; day++) for (let pi = 0; pi < papan.jamPerHari[day]; pi++) {
      if (asal && asal.week === week && asal.day === day && asal.pi === pi) continue;
      const halang = papan.penghalang(sel, week, day, pi, sel.id);
      if (halang.some(h => h.tetap || tabu.has(h.id) || h.classId === sel.classId && h.subject === sel.subject)) continue;
      calon.push({ week, day, pi, halang, skor: papan.nilai(sel, week, day, pi, sel.id) - iw * 2 - halang.length * 4 });
    }
  });
  calon.sort((a, b) => a.halang.length - b.halang.length || b.skor - a.skor);
  for (const c of calon) {
    if (++hitung.n > opsi.anggaran) return null;
    if (c.halang.length === 0) {
      const dari = asal;
      sel.week = c.week; sel.day = c.day; sel.pi = c.pi; papan.pasang(sel);
      return [{ jenis: dari ? "PINDAH" : "BARU", sel, dari, ke: { week: c.week, day: c.day, pi: c.pi } }];
    }
    if (opsi.kedalaman <= 0 || c.halang.length > 2) continue;
    // Cabut penghalang, taruh sel ini, lalu carikan tempat baru untuk tiap penghalang (satu tingkat lebih dangkal).
    const lama = c.halang.map(h => ({ h, week: h.week, day: h.day, pi: h.pi }));
    for (const { h } of lama) papan.cabut(h);
    const dari = asal;
    sel.week = c.week; sel.day = c.day; sel.pi = c.pi; papan.pasang(sel);
    const langkah: Langkah[] = [{ jenis: dari ? "PINDAH" : "BARU", sel, dari, ke: { week: c.week, day: c.day, pi: c.pi } }];
    const tabuBaru = new Set([...tabu, sel.id, ...lama.map(x => x.h.id)]);
    let berhasil = true;
    for (const x of lama) {
      const utama: Minggu = x.h.rotasi ? (x.week as Minggu) : "SEMUA";
      const sub = carikanTempat(papan, x.h, { kedalaman: opsi.kedalaman - 1, anggaran: opsi.anggaran }, hitung, tabuBaru, { week: x.week, day: x.day, pi: x.pi }, utama);
      if (!sub) { berhasil = false; break; }
      langkah.push(...sub);
    }
    if (berhasil) return langkah;
    // Lacak-balik: kembalikan semuanya persis seperti sebelum calon ini dicoba.
    // Sel penghalang (`lama`) dipasang ulang di bawah; sel LAIN yang ikut tergeser lebih dalam dipasang ulang di sini.
    const idLama = new Set(lama.map(x => x.h.id));
    for (const l of langkah.slice(1).reverse()) {
      papan.cabut(l.sel);
      if (l.dari) { l.sel.week = l.dari.week; l.sel.day = l.dari.day; l.sel.pi = l.dari.pi; if (!idLama.has(l.sel.id)) papan.pasang(l.sel); }
    }
    papan.cabut(sel);
    for (const x of lama) { x.h.week = x.week; x.h.day = x.day; x.h.pi = x.pi; papan.pasang(x.h); }
    if (asal) { sel.week = asal.week; sel.day = asal.day; sel.pi = asal.pi; }
  }
  return null;
}

/** Tambahkan `jam` jam pelajaran untuk satu penugasan. Dicoba dari yang paling sedikit mengubah jadwal: tanpa geser,
 *  lalu satu geseran, lalu rantai dua. Mengembalikan langkah yang berhasil dan sisa jam yang tetap tidak muat. */
export function tambahJam(papan: PapanJadwal, k: Kebutuhan, jam: number, anggaran = 40_000): { langkah: Langkah[]; sisa: number } {
  const langkah: Langkah[] = [];
  let sisa = jam;
  while (sisa > 0) {
    let dapat: Langkah[] | null = null;
    for (const kedalaman of [0, 1, 2]) {
      const sel: Sel = { id: papan.idBaru(), rowId: null, classId: k.classId, teacherId: k.teacherId, subject: k.subject, week: k.mingguUtama, day: 0, pi: 0, tetap: false, maxShared: k.maxShared, rotasi: k.rotasi };
      dapat = carikanTempat(papan, sel, { kedalaman, anggaran }, { n: 0 }, new Set(), null, k.mingguUtama);
      if (dapat) break;
    }
    if (!dapat) break;
    langkah.push(...dapat); sisa--;
  }
  return { langkah, sisa };
}

/** Selesaikan satu bentrok guru dengan memindahkan SALAH SATU dari dua sel (yang tidak dipatok; dicoba keduanya). */
export function uraiBentrok(papan: PapanJadwal, a: Sel, b: Sel, anggaran = 40_000): Langkah[] | null {
  for (const kedalaman of [0, 1, 2]) for (const s of [b, a]) {
    if (s.tetap || !papan.sel.has(s.id)) continue;
    const asal = { week: s.week, day: s.day, pi: s.pi };
    papan.cabut(s);
    const h = carikanTempat(papan, s, { kedalaman, anggaran }, { n: 0 }, new Set(), asal, s.rotasi ? s.week : "SEMUA");
    if (h) return h;
    s.week = asal.week; s.day = asal.day; s.pi = asal.pi; papan.pasang(s);
  }
  return null;
}
