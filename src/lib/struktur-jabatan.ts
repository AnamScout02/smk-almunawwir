/**
 * Menjembatani KATALOG JABATAN (tabel `Jabatan`, yang menyalakan menu) dengan STRUKTUR ORGANISASI
 * di situs publik (SiteSetting `school.structure`, daftar nama yang diketik manual di Konten
 * Halaman). Keduanya SENGAJA terpisah: struktur organisasi memuat penulisan gelar dan urutan
 * tampilan yang tidak selalu sama dengan nama jabatan internal.
 *
 * Akibatnya ada satu jebakan: mengganti pemegang jabatan TIDAK memperbarui struktur organisasi,
 * sehingga situs publik bisa tetap menampilkan pejabat lama (pertanyaan user 29 September 2026
 * soal pergantian Waka Kurikulum). Halaman Jabatan memakai pembantu ini untuk MENGINGATKAN —
 * bukan menimpa otomatis, karena nama di struktur ditulis lengkap dengan gelar oleh petugas.
 */

/** Kata yang tidak membedakan satu jabatan dari jabatan lain. */
const UMUM = new Set(["wakil", "waka", "kepala", "bid", "bidang", "sekolah", "koordinator", "ketua", "tim", "urusan"]);

/** Singkatan yang dipakai berbeda antara katalog jabatan dan struktur organisasi. Tanpa ini
 *  "Wakil Kepala Sarana Prasarana" tidak pernah cocok dengan "Waka Bid. Sarpras". */
const SINONIM: Record<string, string[]> = {
  sarpras: ["sarana", "prasarana"],
  sarana: ["sarpras"],
  prasarana: ["sarpras"],
  humas: ["hubungan", "masyarakat"],
  hubungan: ["humas"],
  masyarakat: ["humas"],
};

function inti(teks: string): string[] {
  const dasar = teks
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(k => k.length > 2 && !UMUM.has(k));
  return [...new Set(dasar.flatMap(k => [k, ...(SINONIM[k] ?? [])]))];
}

/**
 * Apakah sebuah baris struktur organisasi (`role`) merujuk jabatan yang sama dengan `namaJabatan`?
 * Dicocokkan lewat kata INTI-nya ("Wakil Kepala Kurikulum" ↔ "Waka Bid. Kurikulum"), bukan teks
 * persis — dua penulisan itu memang berbeda di data sungguhan sekolah ini.
 */
export function jabatanSama(namaJabatan: string, role: string): boolean {
  const a = inti(namaJabatan);
  const b = inti(role);
  if (a.length === 0 || b.length === 0) return false;
  return a.some(k => b.includes(k));
}

export interface BarisStruktur { role: string; name: string; highlight?: boolean }

/**
 * Baris struktur organisasi yang merujuk jabatan ini TETAPI namanya sudah tidak sama dengan
 * pemegang yang baru. Kosong = tidak perlu diapa-apakan.
 */
export function strukturPerluDiperbarui(
  namaJabatan: string,
  pemegang: string[],
  struktur: unknown,
): BarisStruktur[] {
  if (!Array.isArray(struktur)) return [];
  const rapi = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const nama = pemegang.map(rapi);
  return (struktur as BarisStruktur[]).filter(b =>
    b && typeof b.role === "string" && typeof b.name === "string" &&
    jabatanSama(namaJabatan, b.role) &&
    !nama.includes(rapi(b.name)),
  );
}
