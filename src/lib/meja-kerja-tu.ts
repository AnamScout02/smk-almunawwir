import "server-only";
import { pokokKurang, tautanPokok } from "@/lib/induk-pokok";
import { berkasPokokKurang } from "@/lib/berkas-siswa";
import { labelBerkasSiswa } from "@/lib/berkas-siswa-jenis";
import { prisma } from "@/lib/prisma";
import { sebutanSaya } from "@/lib/surat-berkas";
import { mutasiTerbaru } from "@/lib/mutasi-siswa";
import { jalankanPemeriksaan } from "@/lib/pemeriksa-data";
import { kelompokkanSekolah } from "@/lib/nama-sekolah";
import { siswaMenghilang } from "@/lib/siswa-menghilang";

/** `href` = tautan LANGSUNG ke data butir itu (10 Okt 2026, permintaan user: klik butir harus membuka anak/suratnya, bukan
 *  sekadar halaman menunya). Kosong = pakai tautan bagian. Butir baru sebisa mungkin mengisinya. */
export type ButirMeja = { id: string; judul: string; ket: string; waktu: Date | null; telat?: boolean; href?: string };
/** Bagian yang sifatnya KELENGKAPAN DATA (tunggakan lama, ratusan butir) — dipisah dari pekerjaan harian supaya angka
 *  "pekerjaan menunggu" berarti (9 Okt 2026: 1.343 butir, 1.200-an di antaranya tracer/ijazah/buku induk). */
export const KUNCI_KELENGKAPAN = new Set(["pemeriksa", "nama-sekolah", "induk-siswa", "guru", "alumni", "tracer", "ttd", "ijazah",
  "surat-kosong", "surat-tanpa-pindai", "arsip-tanpa-berkas", "berkas-siswa"]);
export type BagianMeja = { kunci: string; judul: string; href: string; aksi: string; jumlah: number; butir: ButirMeja[] };

const H = 86_400_000;
const q = (v: string) => encodeURIComponent(v.slice(0, 80));
/** Letak isian Buku Induk Guru: bagian accordion + awalan label (lihat BukuIndukGuruManager). */
const LETAK_GURU: Record<string, [string, string]> = { "NIK": ["personal", "NIK"], "tanggal lahir": ["personal", "Tanggal Lahir"], "tempat lahir": ["personal", "Tempat Lahir"],
  "jenis kelamin": ["personal", "Jenis Kelamin"], "agama": ["personal", "Agama"], "nomor HP": ["personal", "No. HP"], "alamat": ["alamat", "Alamat Lengkap"],
  "pendidikan terakhir": ["kerja", "Pendidikan Terakhir"], "tanggal mulai tugas": ["kerja", "Tanggal Mulai"] };
const tautanGuru = (id: string, kurang: string[]) => { const [b, i] = LETAK_GURU[kurang[0]] ?? ["personal", ""]; return `/dashboard/admin/buku-induk/guru?edit=${id}&bagian=${b}${i ? `&isian=${encodeURIComponent(i)}` : ""}`; };
const pegang = <T,>(p: Promise<T>, cadangan: T) => p.catch(() => cadangan);

/** MEJA KERJA TU (9 Okt 2026) — "yang menunggu dikerjakan hari ini" dalam SATU layar, dengan butir-butirnya (bukan hanya
 *  angka seperti lencana di lonceng). Tiap bagian memakai syarat yang SAMA dengan lencana sidebar / antrean notifikasi
 *  (layout admin & src/lib/antrean-kerja.ts) supaya angkanya tidak pernah berbeda. Bagian yang kosong tidak ditampilkan
 *  pemanggil. Satu bagian gagal dimuat tidak menjatuhkan halaman (`pegang`).
 *  ATURAN (user 9 Okt 2026): SEMUA data TU yang punya keadaan "belum selesai" WAJIB punya bagian di sini. Fitur TU baru yang
 *  mengenal status menunggu/belum lengkap → tambahkan bagiannya di fungsi ini, jangan hanya lencana di menu. */
export async function susunMejaKerja(session: { role: string; email: string; userId: string; name: string }): Promise<BagianMeja[]> {
  const kini = new Date(), sebutan = await sebutanSaya(session);
  const [suratMasuk, disposisiJalan, untukSaya, suratKet, legalisir, bioSiswa, bioPegawai, spmb, arsip, pesan] = await Promise.all([
    pegang(prisma.surat.findMany({ where: { tipe: "MASUK", disposisi: { none: {} } }, orderBy: { tanggal: "asc" }, select: { id: true, pihak: true, perihal: true, tanggal: true, fileUrl: true } }), []),
    pegang(prisma.disposisi.findMany({ where: { status: { not: "SELESAI" } }, orderBy: [{ batasWaktu: "asc" }, { tanggal: "asc" }], select: { id: true, tujuan: true, batasWaktu: true, tanggal: true, surat: { select: { perihal: true } } } }), []),
    pegang(prisma.disposisi.findMany({ where: { status: { not: "SELESAI" }, tujuan: { hasSome: sebutan } }, orderBy: { tanggal: "asc" }, select: { id: true, instruksi: true, batasWaktu: true, tanggal: true, surat: { select: { perihal: true } } } }), []),
    pegang(prisma.suratKeterangan.findMany({ where: { requestStatus: "DIAJUKAN" }, orderBy: { requestedAt: "asc" }, select: { id: true, namaSiswa: true, kelasSiswa: true, jenis: true, keperluan: true, requestedAt: true } }), []),
    pegang(prisma.legalisirRequest.findMany({ where: { requestStatus: "DIAJUKAN" }, orderBy: { requestedAt: "asc" }, select: { id: true, applicantName: true, documentType: true, copies: true, requestedAt: true } }), []),
    pegang(prisma.profileEditRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } } }), []),
    pegang(prisma.pegawaiEditRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, user: { select: { name: true } } } }), []),
    pegang(prisma.admission.findMany({ where: { verifikasiStatus: "BELUM", status: { notIn: ["DITOLAK", "REJECTED"] } }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, chosenMajor: true, createdAt: true } }), []),
    pegang(prisma.arsip.findMany({ where: { berlakuSampai: { lte: new Date(kini.getTime() + 60 * H) } }, orderBy: { berlakuSampai: "asc" }, select: { id: true, judul: true, kategori: true, berlakuSampai: true } }), []),
    pegang(prisma.contactMessage.findMany({ where: { isRead: false }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, subject: true, createdAt: true } }), []),
  ]);
  const lama = (d: Date | null, hari: number) => !!d && kini.getTime() - d.getTime() > hari * H;
  // ── Gelombang kedua (permintaan user 9 Okt 2026: "semua data yang berhubungan dengan TU yang belum selesai") ──
  const hariIni = new Date(new Date(kini.getTime() + 7 * 3600_000).toISOString().slice(0, 10) + "T00:00:00Z");
  const tahunLulus = String(new Date(kini.getTime() - 540 * H).getUTCFullYear()); // lulusan ±18 bulan terakhir
  const [mutasi, legalProses, legalSiap, ekspedisi, cuti, bantuan, tamu, sk, suratKosong, lulusan, tanpaTtd, tanpaTtdContoh, periksa, namaSekolah, guru, alumni, tracer, suratTanpaPindai, nomorKeluar, arsipTanpaBerkas, siswaAktif] = await Promise.all([
    pegang(mutasiTerbaru().then(x => x.filter(y => y.sisaManual > 0)), []),
    pegang(prisma.legalisirRequest.findMany({ where: { status: "DIPROSES", OR: [{ requestStatus: null }, { requestStatus: "DISETUJUI" }] }, orderBy: { requestDate: "asc" }, select: { id: true, applicantName: true, documentType: true, copies: true, requestDate: true } }), []),
    pegang(prisma.legalisirRequest.findMany({ where: { status: "SELESAI" }, orderBy: { requestDate: "asc" }, select: { id: true, applicantName: true, documentType: true, requestDate: true } }), []),
    pegang(prisma.ekspedisi.findMany({ where: { status: "DIKIRIM" }, orderBy: { tanggal: "asc" }, select: { id: true, perihal: true, tujuan: true, tanggal: true } }), []),
    pegang(prisma.staffLeave.findMany({ where: { status: "DIAJUKAN" }, orderBy: { startDate: "asc" }, select: { id: true, jenis: true, days: true, startDate: true, teacher: { select: { user: { select: { name: true } } } } } }), []),
    pegang(prisma.bantuanSiswa.findMany({ where: { statusAmbil: "BELUM", tanggalCair: { not: null } }, orderBy: { tanggalCair: "asc" }, select: { id: true, jenis: true, tahap: true, tanggalCair: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } } }), []),
    pegang(prisma.guestBookEntry.findMany({ where: { visitDate: { gte: hariIni, lt: new Date(hariIni.getTime() + H) }, timeOut: null }, orderBy: { visitDate: "asc" }, select: { id: true, guestName: true, purpose: true, visitDate: true } }), []),
    pegang(prisma.arsipSk.findMany({ where: { berlakuSampai: { lte: new Date(kini.getTime() + 60 * H) } }, orderBy: { berlakuSampai: "asc" }, select: { id: true, judul: true, jenis: true, berlakuSampai: true, teacherId: true } }), []),
    pegang(prisma.surat.findMany({ where: { tipe: "KELUAR", content: null, docxUrl: null, fileUrl: null, createdAt: { gte: new Date(kini.getTime() - 90 * H) } }, orderBy: { tanggal: "asc" }, select: { id: true, nomor: true, perihal: true, tanggal: true } }), []),
    pegang(prisma.student.findMany({ where: { studentStatus: "LULUS", ijazahHandovers: { none: { dokumen: { has: "IJAZAH" } } } }, select: { id: true, bukuIndukData: true, user: { select: { name: true } }, class: { select: { name: true } } } }), []),
    pegang(prisma.user.count({ where: { role: { in: ["TEACHER", "TAS"] }, ttdBerkas: null } }), 0),
    pegang(prisma.user.findMany({ where: { role: { in: ["TEACHER", "TAS"] }, ttdBerkas: null }, take: 400, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }), []),
    // PEMERIKSA DATA — temuan yang sama persis dengan halamannya (satu sumber `jalankanPemeriksaan`).
    pegang(jalankanPemeriksaan({ batasContoh: 1 }).then(x => x.temuan), []),
    // NAMA SEKOLAH ASAL yang ditulis berbeda-beda / mirip (Rapikan Nama Sekolah, sumber Buku Induk).
    pegang(prisma.student.groupBy({ by: ["previousSchool"], where: { previousSchool: { not: null } }, _count: { _all: true } })
      .then(g => kelompokkanSekolah(g.filter(x => x.previousSchool?.trim()).map(x => ({ nama: x.previousSchool as string, jumlah: x._count._all }))).filter(x => x.varian.length > 1)), []),
    // DATA GURU aktif yang isian pokoknya masih kosong.
    pegang(prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, orderBy: { user: { name: "asc" } }, select: { id: true, nip: true, phone: true, birthDate: true, birthPlace: true, address: true, education: true, gender: true, religion: true, startDate: true, bukuIndukData: true, user: { select: { name: true } } } }), []),
    // DATA ALUMNI: lulusan yang catatan kelulusannya belum lengkap.
    pegang(prisma.student.findMany({ where: { studentStatus: "LULUS" }, select: { id: true, bukuIndukData: true, user: { select: { name: true } }, major: { select: { code: true } } } }), []),
    pegang(prisma.alumniTracer.findMany({ select: { studentId: true } }).then(x => new Set(x.map(y => y.studentId))), new Set<string>()),
    // DATA SURAT & ARSIP yang belum lengkap.
    pegang(prisma.surat.findMany({ where: { tipe: "MASUK", fileUrl: null, tanggal: { gte: new Date(kini.getTime() - 180 * H) } }, orderBy: { tanggal: "desc" }, select: { id: true, pihak: true, perihal: true, tanggal: true } }), []),
    pegang(prisma.surat.findMany({ where: { tipe: "KELUAR", tanggal: { gte: new Date(kini.getTime() - 400 * H) } }, select: { id: true, nomor: true, perihal: true, tanggal: true } }), []),
    pegang(prisma.arsip.findMany({ where: { fileUrl: null }, orderBy: { tanggal: "desc" }, select: { id: true, judul: true, kategori: true, tanggal: true } }), []),
    // BUKU INDUK SISWA: siswa aktif yang isian POKOK-nya masih kosong.
    pegang(prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { id: true, nisn: true, gender: true, birthPlace: true, birthDate: true, religion: true, address: true, parentPhone: true, previousSchool: true, bukuIndukData: true, user: { select: { name: true } }, class: { select: { name: true } } } }), []),
  ]);
  const perNomor = new Map<string, typeof nomorKeluar>();
  for (const x of nomorKeluar) { const n = x.nomor.trim().toLowerCase(); if (n) perNomor.set(n, [...(perNomor.get(n) ?? []), x]); }
  const nomorKembar = [...perNomor.values()].filter(v => v.length > 1);
  const namaGuru = new Map(guru.map(g => [g.id, g.user.name]));
  const bi = (v: unknown) => (v ?? {}) as Record<string, unknown>;
  const isi = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  // Isian pokok = satu sumber dengan Profil Siswa (src/lib/induk-pokok.ts).
  const siswaKurang = siswaAktif.map(x => {
    const kurang = pokokKurang(x);
    return { id: x.id, nama: x.user.name, kelas: x.class?.name ?? "tanpa kelas", kurang };
  }).filter(x => x.kurang.length > 0).sort((a, b) => b.kurang.length - a.kurang.length || a.kelas.localeCompare(b.kelas, "id", { numeric: true }));
  const sebut = (k: string[]) => `belum ada: ${k.slice(0, 4).join(", ")}${k.length > 4 ? ` dan ${k.length - 4} lainnya` : ""}`;
  const guruKurang = guru.map(g => {
    const d = bi(g.bukuIndukData);
    const kurang = [!isi(d.nik) && "NIK", !g.birthDate && "tanggal lahir", !isi(g.birthPlace) && "tempat lahir", !isi(g.gender) && "jenis kelamin", !isi(g.religion) && "agama", !isi(g.address) && "alamat", !isi(g.phone) && "nomor HP", !isi(g.education) && "pendidikan terakhir", !g.startDate && "tanggal mulai tugas"].filter((x): x is string => !!x);
    return { id: g.id, nama: g.user.name, kurang };
  }).filter(g => g.kurang.length > 0).sort((a, b) => b.kurang.length - a.kurang.length);
  const alumniKurang = alumni.map(a => {
    const d = bi(a.bukuIndukData);
    const kurang = [!isi(d.graduationDate) && "tanggal lulus", !isi(d.graduationIjazahNo) && "nomor ijazah"].filter((x): x is string => !!x);
    return { id: a.id, nama: a.user.name, jurusan: a.major?.code ?? "", kurang };
  }).filter(a => a.kurang.length > 0);
  const belumTracer = alumni.filter(a => !tracer.has(a.id));
  const URUT: Record<string, number> = { kritis: 0, penting: 1, saran: 2 };
  const temuan = [...periksa].sort((a, b) => URUT[a.kategori] - URUT[b.kategori] || b.jumlah - a.jumlah);
  const lulusBelum = lulusan.filter(s => String(((s.bukuIndukData ?? {}) as Record<string, unknown>).graduationDate ?? "") >= `${tahunLulus}-01-01`);
  const bagian: BagianMeja[] = [
    { kunci: "disposisi-saya", judul: "Disposisi untuk saya", href: "/dashboard/admin/disposisi-surat", aksi: "Tindak lanjuti", jumlah: untukSaya.length,
      butir: untukSaya.map(d => ({ href: `/dashboard/admin/disposisi-surat?sorot=${d.id}`, id: d.id, judul: d.surat.perihal, ket: d.instruksi.slice(0, 120), waktu: d.batasWaktu ?? d.tanggal, telat: !!d.batasWaktu && d.batasWaktu < kini })) },
    { kunci: "surat-masuk", judul: "Surat masuk belum didisposisi", href: "/dashboard/admin/disposisi", aksi: "Buka disposisi", jumlah: suratMasuk.length,
      butir: suratMasuk.map(s => ({ href: `/dashboard/admin/persuratan?cari=${q(s.perihal)}`, id: s.id, judul: s.perihal, ket: `Dari ${s.pihak}${s.fileUrl ? "" : " · tanpa pindaian"}`, waktu: s.tanggal, telat: lama(s.tanggal, 3) })) },
    { kunci: "disposisi-jalan", judul: "Disposisi belum selesai", href: "/dashboard/admin/disposisi", aksi: "Pantau", jumlah: disposisiJalan.length,
      butir: disposisiJalan.map(d => ({ href: `/dashboard/admin/disposisi?cari=${q(d.surat.perihal)}`, id: d.id, judul: d.surat.perihal, ket: `Kepada ${d.tujuan.join(", ")}`, waktu: d.batasWaktu ?? d.tanggal, telat: !!d.batasWaktu && d.batasWaktu < kini })) },
    { kunci: "permintaan-surat", judul: "Permintaan surat keterangan", href: "/dashboard/admin/permintaan-surat", aksi: "Proses", jumlah: suratKet.length,
      butir: suratKet.map(s => ({ href: `/dashboard/admin/permintaan-surat?sorot=${s.id}`, id: s.id, judul: `${s.namaSiswa}${s.kelasSiswa ? ` (${s.kelasSiswa})` : ""}`, ket: `${s.jenis.replace(/_/g, " ").toLowerCase()} — ${s.keperluan}`.slice(0, 140), waktu: s.requestedAt, telat: lama(s.requestedAt, 2) })) },
    { kunci: "legalisir", judul: "Permintaan legalisir", href: "/dashboard/admin/permintaan-surat", aksi: "Proses", jumlah: legalisir.length,
      butir: legalisir.map(l => ({ href: `/dashboard/admin/permintaan-surat?sorot=${l.id}`, id: l.id, judul: l.applicantName, ket: `${l.documentType.toLowerCase()} · ${l.copies} lembar`, waktu: l.requestedAt, telat: lama(l.requestedAt, 2) })) },
    { kunci: "biodata", judul: "Perubahan biodata menunggu verifikasi", href: "/dashboard/admin/verifikasi-data", aksi: "Verifikasi", jumlah: bioSiswa.length + bioPegawai.length,
      butir: [...bioSiswa.map(b => ({ href: `/dashboard/admin/verifikasi-data?cari=${q(b.student.user.name)}`, id: b.id, judul: b.student.user.name, ket: `Siswa${b.student.class ? ` · ${b.student.class.name}` : ""}`, waktu: b.createdAt, telat: lama(b.createdAt, 3) })),
        ...bioPegawai.map(b => ({ href: `/dashboard/admin/verifikasi-data?cari=${q(b.user.name)}`, id: b.id, judul: b.user.name, ket: "Guru / staf", waktu: b.createdAt, telat: lama(b.createdAt, 3) }))].sort((a, z) => (a.waktu?.getTime() ?? 0) - (z.waktu?.getTime() ?? 0)) },
    { kunci: "spmb", judul: "Berkas SPMB belum diverifikasi", href: "/pusat-spmb/tahapan", aksi: "Periksa berkas", jumlah: spmb.length,
      butir: spmb.map(a => ({ href: `/pusat-spmb/tahapan?buka=${a.id}`, id: a.id, judul: a.fullName, ket: a.chosenMajor || "jurusan belum dipilih", waktu: a.createdAt, telat: lama(a.createdAt, 3) })) },
    { kunci: "arsip", judul: "Dokumen arsip habis / segera habis masa berlakunya", href: "/dashboard/admin/arsip", aksi: "Buka arsip", jumlah: arsip.length,
      butir: arsip.map(a => ({ href: `/dashboard/admin/arsip?cari=${q(a.judul)}`, id: a.id, judul: a.judul, ket: a.kategori, waktu: a.berlakuSampai, telat: !!a.berlakuSampai && a.berlakuSampai < kini })) },
    { kunci: "pesan", judul: "Pesan masuk dari situs belum dibaca", href: "/dashboard/admin/messages", aksi: "Baca", jumlah: pesan.length,
      butir: pesan.map(p => ({ href: `/dashboard/admin/messages?sorot=${p.id}`, id: p.id, judul: p.name, ket: p.subject || "tanpa judul", waktu: p.createdAt, telat: lama(p.createdAt, 3) })) },
    { kunci: "mutasi", judul: "Mutasi siswa: langkah belum lengkap", href: "/dashboard/admin/mutasi-siswa", aksi: "Buka daftar periksa", jumlah: mutasi.length,
      butir: mutasi.map(x => ({ href: `/dashboard/admin/mutasi-siswa?periksa=${x.id}`, id: x.id, judul: x.nama, ket: `${x.arah === "MASUK" ? "Pindah masuk" : x.status === "PINDAH" ? "Pindah" : "Keluar"} · ${x.sisaManual} langkah belum dicentang`, waktu: x.tanggal, telat: lama(x.tanggal, 14) })) },
    { kunci: "legalisir-proses", judul: "Legalisir sedang dikerjakan", href: "/dashboard/admin/legalisir", aksi: "Selesaikan", jumlah: legalProses.length,
      butir: legalProses.map(l => ({ href: `/dashboard/admin/legalisir?cari=${q(l.applicantName)}`, id: l.id, judul: l.applicantName, ket: `${l.documentType.toLowerCase()} · ${l.copies} lembar`, waktu: l.requestDate, telat: lama(l.requestDate, 3) })) },
    { kunci: "legalisir-siap", judul: "Legalisir selesai, belum diambil", href: "/dashboard/admin/legalisir", aksi: "Tandai diambil", jumlah: legalSiap.length,
      butir: legalSiap.map(l => ({ href: `/dashboard/admin/legalisir?cari=${q(l.applicantName)}`, id: l.id, judul: l.applicantName, ket: l.documentType.toLowerCase(), waktu: l.requestDate, telat: lama(l.requestDate, 14) })) },
    { kunci: "ekspedisi", judul: "Surat terkirim belum ada tanda terima", href: "/dashboard/admin/ekspedisi", aksi: "Buka ekspedisi", jumlah: ekspedisi.length,
      butir: ekspedisi.map(e => ({ href: `/dashboard/admin/ekspedisi?cari=${q(e.perihal)}`, id: e.id, judul: e.perihal, ket: `Kepada ${e.tujuan}`, waktu: e.tanggal, telat: lama(e.tanggal, 7) })) },
    { kunci: "surat-kosong", judul: "Surat keluar bernomor tetapi belum ada isinya", href: "/dashboard/admin/persuratan", aksi: "Lengkapi", jumlah: suratKosong.length,
      butir: suratKosong.map(x => ({ href: `/dashboard/admin/persuratan?cari=${q(x.nomor)}&tab=KELUAR`, id: x.id, judul: x.perihal, ket: x.nomor, waktu: x.tanggal, telat: lama(x.tanggal, 3) })) },
    { kunci: "surat-tanpa-pindai", judul: "Surat masuk belum ada pindaiannya", href: "/dashboard/admin/persuratan", aksi: "Pindai", jumlah: suratTanpaPindai.length,
      butir: suratTanpaPindai.map(x => ({ href: `/dashboard/admin/persuratan?cari=${q(x.perihal)}`, id: x.id, judul: x.perihal, ket: `Dari ${x.pihak}`, waktu: x.tanggal })) },
    { kunci: "nomor-kembar", judul: "Nomor surat keluar dipakai lebih dari sekali", href: "/dashboard/admin/persuratan", aksi: "Periksa", jumlah: nomorKembar.length,
      butir: nomorKembar.map(v => ({ href: `/dashboard/admin/persuratan?cari=${q(v[0].nomor)}&tab=KELUAR`, id: v[0].id, judul: v[0].nomor, ket: `${v.length} surat: ${v.map(x => x.perihal).join(" · ")}`.slice(0, 160), waktu: v[0].tanggal, telat: true })) },
    { kunci: "arsip-tanpa-berkas", judul: "Arsip dicatat tanpa berkas", href: "/dashboard/admin/arsip", aksi: "Lengkapi", jumlah: arsipTanpaBerkas.length,
      butir: arsipTanpaBerkas.map(x => ({ href: `/dashboard/admin/arsip?cari=${q(x.judul)}`, id: x.id, judul: x.judul, ket: x.kategori, waktu: x.tanggal })) },
    { kunci: "cuti", judul: "Pengajuan cuti pegawai menunggu", href: "/dashboard/admin/cuti", aksi: "Putuskan", jumlah: cuti.length,
      butir: cuti.map(x => ({ href: `/dashboard/admin/cuti?cari=${q(x.teacher.user.name)}`, id: x.id, judul: x.teacher.user.name, ket: `${x.jenis.replace(/_/g, " ").toLowerCase()} · ${x.days} hari`, waktu: x.startDate, telat: x.startDate < kini })) },
    { kunci: "sk", judul: "SK / sertifikat pegawai habis atau segera habis", href: "/dashboard/admin/arsip-sk", aksi: "Buka arsip SK", jumlah: sk.length,
      butir: sk.map(x => ({ href: `/dashboard/admin/arsip-sk?sorot=${x.id}`, id: x.id, judul: x.judul, ket: `${namaGuru.get(x.teacherId) ?? "—"} · ${x.jenis.toLowerCase()}`, waktu: x.berlakuSampai, telat: !!x.berlakuSampai && x.berlakuSampai < kini })) },
    { kunci: "bantuan", judul: "Bantuan / beasiswa sudah cair, belum diambil", href: "/dashboard/admin/bantuan-siswa", aksi: "Buka bantuan", jumlah: bantuan.length,
      butir: bantuan.map(x => ({ href: `/dashboard/admin/bantuan-siswa?cari=${q(x.student.user.name)}`, id: x.id, judul: x.student.user.name, ket: `${x.jenis.replace(/_/g, " ")}${x.tahap ? ` ${x.tahap}` : ""}${x.student.class ? ` · ${x.student.class.name}` : ""}`, waktu: x.tanggalCair, telat: lama(x.tanggalCair, 30) })) },
    { kunci: "ijazah", judul: "Lulusan belum mengambil ijazah", href: `/dashboard/admin/paket-kelulusan?lulus=${new Date(kini.getTime() + 7 * 3600_000).getUTCFullYear()}`, aksi: "Paket Kelulusan", jumlah: lulusBelum.length,
      butir: lulusBelum.map(x => ({ href: `/dashboard/admin/students/${x.id}`, id: x.id, judul: x.user.name, ket: x.class?.name ?? "lulusan", waktu: null })) },
    { kunci: "tamu", judul: "Tamu hari ini belum ditandai pulang", href: "/dashboard/admin/buku-tamu", aksi: "Buku tamu", jumlah: tamu.length,
      butir: tamu.map(x => ({ href: `/dashboard/admin/buku-tamu?cari=${q(x.guestName)}`, id: x.id, judul: x.guestName, ket: x.purpose, waktu: null })) },
    { kunci: "pemeriksa", judul: "Pemeriksa Data: temuan pada data siswa", href: "/dashboard/admin/pemeriksa-data", aksi: "Buka Pemeriksa Data", jumlah: temuan.length,
      butir: temuan.map(t => ({ href: `/dashboard/admin/pemeriksa-data#temuan-${t.id}`, id: t.id, judul: t.judul, ket: `${t.jumlah} data · ${t.kategori}`, waktu: null, telat: t.kategori === "kritis" })) },
    { kunci: "nama-sekolah", judul: "Nama sekolah asal ditulis berbeda-beda", href: "/dashboard/admin/rapikan-sekolah", aksi: "Rapikan Nama Sekolah", jumlah: namaSekolah.length,
      butir: [...namaSekolah].sort((a, b) => b.varian.length - a.varian.length).map(x => ({ href: `/dashboard/admin/rapikan-sekolah?sorot=${q(x.saran)}`, id: x.saran, judul: x.saran, ket: `${x.varian.length} penulisan · ${x.varian.reduce((n, v) => n + v.jumlah, 0)} siswa · ${x.pasti ? "pasti sama" : "mirip, perlu diperiksa"}`, waktu: null })) },
    { kunci: "induk-siswa", judul: "Buku Induk Siswa belum lengkap", href: "/dashboard/admin/buku-induk/siswa", aksi: "Buku Induk Siswa", jumlah: siswaKurang.length,
      butir: siswaKurang.map(x => ({ href: tautanPokok(x.id, x.kurang), id: x.id, judul: x.nama, ket: `${x.kelas} · ${sebut(x.kurang)}`, waktu: null })) },
    { kunci: "guru", judul: "Buku Induk Guru belum lengkap", href: "/dashboard/admin/buku-induk/guru", aksi: "Buku Induk Guru", jumlah: guruKurang.length,
      butir: guruKurang.map(g => ({ href: tautanGuru(g.id, g.kurang), id: g.id, judul: g.nama, ket: sebut(g.kurang), waktu: null })) },
    { kunci: "alumni", judul: "Data alumni belum lengkap", href: "/dashboard/admin/buku-induk/siswa", aksi: "Buku Induk Siswa", jumlah: alumniKurang.length,
      butir: alumniKurang.map(a => ({ href: tautanPokok(a.id, a.kurang), id: a.id, judul: a.nama, ket: `${a.jurusan ? `${a.jurusan} · ` : ""}belum ada: ${a.kurang.join(", ")}`, waktu: null })) },
    { kunci: "tracer", judul: "Alumni belum mengisi tracer study", href: "/dashboard/admin/tracer-study", aksi: "Tracer Study", jumlah: belumTracer.length,
      butir: belumTracer.map(a => ({ href: `/dashboard/admin/tracer-study?cari=${q(a.user.name)}`, id: a.id, judul: a.user.name, ket: a.major?.code ?? "alumni", waktu: null })) },
    { kunci: "ttd", judul: "Guru & staf belum punya tanda tangan digital", href: "/dashboard/admin/tanda-tangan", aksi: "Tanda Tangan Pegawai", jumlah: tanpaTtd,
      butir: tanpaTtdContoh.map(x => ({ href: `/dashboard/admin/tanda-tangan?cari=${q(x.name)}`, id: x.id, judul: x.name, ket: x.role === "TAS" ? "Staf" : "Guru", waktu: null })) },
  ];
  // BERKAS SISWA DIGITAL: dokumen pokok (ijazah SMP, KK, akta) yang belum dipindai — sumber sama dengan Profil Siswa.
  const berkasKurang = await pegang(berkasPokokKurang(), []);
  bagian.push({ kunci: "berkas-siswa", judul: "Berkas siswa belum dipindai", href: "/dashboard/admin/students", aksi: "Kelola Siswa", jumlah: berkasKurang.length,
    butir: berkasKurang.sort((x, y) => x.kelas.localeCompare(y.kelas, "id", { numeric: true }) || x.nama.localeCompare(y.nama, "id"))
      .map(x => ({ href: `/dashboard/admin/students/${x.id}#berkas`, id: x.id, judul: x.nama, ket: `${x.kelas} · belum ada: ${x.kurang.map(labelBerkasSiswa).join(", ")}`, waktu: null })) });
  // SISWA "AKTIF" YANG DIDUGA SUDAH TIDAK BERSEKOLAH — sumber `siswaMenghilang`; ditindak lewat Mutasi Siswa (Keluar).
  const hilang = await pegang(siswaMenghilang(), []);
  const tglId = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  bagian.push({ kunci: "siswa-menghilang", judul: "Siswa aktif yang diduga sudah tidak bersekolah", href: "/dashboard/admin/mutasi-siswa", aksi: "Mutasi Siswa", jumlah: hilang.length,
    butir: hilang.map(x => ({ href: `/dashboard/admin/mutasi-siswa?keluar=${x.id}`, id: x.id, judul: x.nama, telat: true, waktu: x.terakhirHadir,
      ket: `${x.kelas} · tidak hadir ${x.alpha} dari ${x.hari} hari absensi terakhir · ${x.terakhirHadir ? `terakhir hadir ${tglId(x.terakhirHadir)}` : "belum pernah tercatat hadir"} — pastikan dulu ke wali kelas` })) });
  return bagian;
}
