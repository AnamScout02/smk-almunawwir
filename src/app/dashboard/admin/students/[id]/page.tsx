export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { UserCircle } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Panel from "@/components/shared/Panel";
import { TautanIkon } from "@/components/shared/IkonNama";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { muatProfilSiswa } from "@/lib/profil-siswa";
import BerkasSiswaPanel from "@/components/admin/BerkasSiswaPanel";
import { JUMLAH_POKOK, tautanPokok } from "@/lib/induk-pokok";
import { penempatanBelumPasti } from "@/lib/pkl-tempat";

export const metadata = { title: "Profil Siswa" };

const tgl = (d: Date | string | null | undefined, gaya: "long" | "short" = "long") => {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return isNaN(x.getTime()) ? "—" : x.toLocaleDateString("id-ID", { day: "numeric", month: gaya, year: "numeric", timeZone: "Asia/Jakarta" });
};
const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const WARNA_STATUS: Record<string, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 border-emerald-200", LULUS: "bg-blue-50 text-blue-700 border-blue-200",
  PINDAH: "bg-amber-50 text-amber-700 border-amber-200", KELUAR: "bg-red-50 text-red-600 border-red-200",
};
const kosong = "text-sm text-gray-400";

function Isi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-primary-900">{children || <span className="font-normal text-gray-400">—</span>}</dd>
    </div>
  );
}
function Baris({ kiri, ket, kanan }: { kiri: React.ReactNode; ket?: React.ReactNode; kanan?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-5 py-2.5 text-sm">
      <span className="min-w-0 flex-1"><span className="block truncate font-medium text-primary-900">{kiri}</span>{ket && <span className="block truncate text-xs text-gray-500">{ket}</span>}</span>
      {kanan && <span className="angka shrink-0 text-xs text-gray-500">{kanan}</span>}
    </li>
  );
}

/** PROFIL SISWA — satu halaman berisi semua yang tercatat tentang satu siswa (9 Okt 2026), untuk menjawab pertanyaan
 *  orang tua atau instansi tanpa membuka banyak menu. Hanya MEMBACA; mengubah data tetap di menu masing-masing. */
export default async function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  const p = await muatProfilSiswa(id);
  if (!p) notFound();
  const { siswa: s, induk: d, rekapAbsen: a } = p;
  const status = s.studentStatus ?? "AKTIF";
  const persen = a.total ? Math.round((a.HADIR / a.total) * 100) : null;
  // Alamat lama sering sudah memuat desa/kecamatan — bagian wilayah hanya ditambahkan bila belum tertulis di sana.
  const alamatDasar = (s.address ?? "").trim(), alamatKecil = alamatDasar.toLowerCase();
  const alamat = [alamatDasar, ...[d.desa, d.kecamatan, d.kabupaten, d.province].filter(w => w && !alamatKecil.includes(String(w).toLowerCase().replace(/^(kabupaten|kota)\s+/, "")))].filter(Boolean).join(", ");
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCircle size={22} />} title={s.user.name}
        description={`NIS ${s.nis}${s.class ? ` · ${s.class.name}` : ""} · ${s.major.name} — semua data siswa ini dalam satu halaman`} />
      <BarisKembali href="/dashboard/admin/students" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-6">
          <StatTile value={persen === null ? "—" : `${persen}%`} label={`Kehadiran ${p.tahunAjaran}`} ikon="hadir" color="emerald" />
          <StatTile value={a.ALPHA} label="Alpha tahun ajaran ini" ikon="alpha" color="red" sorot={a.ALPHA >= 3} />
          <StatTile value={p.poinPelanggaran} label="Poin pelanggaran" ikon="poin-turun" color="amber" />
          <StatTile value={p.poinPrestasi} label="Poin prestasi" ikon="prestasi" color="blue" />
          <StatTile value={p.pinjaman.length} label="Buku sedang dipinjam" ikon="buku" color="purple" />
          <StatTile value={`${JUMLAH_POKOK - p.kurang.length}/${JUMLAH_POKOK}`} label="Isian pokok Buku Induk" ikon="daftar-centang" color={p.kurang.length ? "amber" : "primary"} sorot={p.kurang.length > 0} />
        </div>

        <div className="baris-alat">
          <div className="alat-aksi alat-teks">
            <TautanIkon href={`/dashboard/admin/buku-induk/siswa/${s.id}/cetak`} ikon="cetak" className="btn-modal-cancel">Buku Induk</TautanIkon>
            <TautanIkon href={`/dashboard/admin/buku-induk/siswa/${s.id}/riwayat`} ikon="jam" className="btn-modal-cancel">Riwayat perubahan ({p.perubahan})</TautanIkon>
            <TautanIkon href={`/dashboard/admin/buku-induk/siswa?edit=${s.id}`} ikon="profil" className="btn-modal-save">Ubah Buku Induk</TautanIkon>
          </div>
        </div>

        {(p.kurang.length > 0 || p.pengajuan > 0) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {p.kurang.length > 0 && <p>Isian pokok yang belum ada: {p.kurang.map((k, i) => <span key={k}>{i > 0 && ", "}<Link href={tautanPokok(s.id, [k])} className="font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-900">{k}</Link></span>)}. Ketuk satu isian untuk langsung mengisinya.</p>}
            {p.pengajuan > 0 && <p>Ada {p.pengajuan} pengajuan perubahan biodata dari siswa ini yang menunggu verifikasi.</p>}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="min-w-0 space-y-6 xl:col-span-7">
            <Panel judul="Identitas" keterangan={<span className={`status-badge ${WARNA_STATUS[status] ?? WARNA_STATUS.AKTIF}`}>{status}</span>}>
              <div className="flex flex-col gap-5 sm:flex-row">
                {p.foto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.foto} alt="" className="h-36 w-28 shrink-0 rounded-xl border border-gray-100 object-cover" />
                  : <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 px-2 text-center text-sm text-gray-400">Belum ada foto</div>}
                <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Isi label="NIS / NISN">{s.nis} / {s.nisn || "—"}</Isi>
                  <Isi label="NIK">{d.nik}</Isi>
                  <Isi label="Tempat, tanggal lahir">{[s.birthPlace, s.birthDate ? tgl(s.birthDate) : ""].filter(Boolean).join(", ")}</Isi>
                  <Isi label="Jenis kelamin · Agama">{[s.gender === "L" ? "Laki-laki" : s.gender === "P" ? "Perempuan" : "", s.religion].filter(Boolean).join(" · ")}</Isi>
                  <Isi label="Kelas · Wali kelas">{[s.class?.name, s.class?.homeroom?.user.name].filter(Boolean).join(" · ")}</Isi>
                  <Isi label="Asal sekolah">{s.previousSchool}</Isi>
                  <Isi label="Diterima">{[d.diterimaDate ? tgl(d.diterimaDate) : s.enrollYear ? `Tahun ${s.enrollYear}` : "", d.pindahanDari ? `pindahan dari ${d.pindahanDari}` : ""].filter(Boolean).join(" · ")}</Isi>
                  <Isi label="Akun">{s.user.email}</Isi>
                  {status !== "AKTIF" && <Isi label={status === "LULUS" ? "Tanggal lulus" : "Tanggal keluar"}>{tgl(p.keluar)}{d.transferTo ? ` · ke ${d.transferTo}` : ""}</Isi>}
                  <div className="sm:col-span-2"><Isi label="Alamat">{alamat}</Isi></div>
                </dl>
              </div>
            </Panel>

            <Panel judul="Orang Tua & Kontak">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Isi label="Ayah">{[d.fatherName, d.fatherJob].filter(Boolean).join(" · ")}</Isi>
                <Isi label="Ibu">{[d.motherName, d.motherJob].filter(Boolean).join(" · ")}</Isi>
                <Isi label="Wali / nama orang tua di akun">{[s.parentName, s.parentJob].filter(Boolean).join(" · ")}</Isi>
                <Isi label="HP orang tua">{s.parentPhone}</Isi>
                <Isi label="HP siswa">{d.studentPhone}</Isi>
                <Isi label="Akun orang tua terhubung">{p.ortu.map(o => o.name).join(", ")}</Isi>
              </dl>
            </Panel>

            <Panel judul={`Kehadiran ${p.tahunAjaran}`} tautan={{ label: "Absensi", href: "/dashboard/admin/absensi-siswa" }} isi={false}>
              {a.total === 0 ? <p className={`px-5 py-4 ${kosong}`}>Belum ada catatan kehadiran pada tahun ajaran ini.</p> : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Bulan</th><th className="text-right">Hadir</th><th className="text-right">Izin</th><th className="text-right">Sakit</th><th className="text-right">Alpha</th></tr></thead>
                    <tbody>
                      {p.perBulan.map(([k, b]) => (
                        <tr key={k}><td>{BULAN[Number(k.slice(5)) - 1]} {k.slice(0, 4)}</td><td className="angka text-right">{b.HADIR}</td><td className="angka text-right">{b.IZIN}</td><td className="angka text-right">{b.SAKIT}</td><td className={`angka text-right ${b.ALPHA ? "font-semibold text-red-600" : ""}`}>{b.ALPHA}</td></tr>
                      ))}
                      <tr className="font-semibold"><td>Tahun ajaran ini</td><td className="angka text-right">{a.HADIR}</td><td className="angka text-right">{a.IZIN}</td><td className="angka text-right">{a.SAKIT}</td><td className="angka text-right">{a.ALPHA}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
              {p.izin.length > 0 && (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {p.izin.map(i => <Baris key={i.id} kiri={`Pengajuan ${i.jenis.toLowerCase()} — ${i.status.toLowerCase()}`} kanan={`${tgl(i.tanggalMulai, "short")}${+i.tanggalSelesai !== +i.tanggalMulai ? ` – ${tgl(i.tanggalSelesai, "short")}` : ""}`} />)}
                </ul>
              )}
            </Panel>

            <Panel judul="Nilai" keterangan="ringkasan — rinciannya di rapor" isi={false}>
              {p.nilai.length === 0 ? <p className={`px-5 py-4 ${kosong}`}>Belum ada nilai yang tercatat.</p> : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Semester</th><th>Jenis</th><th className="text-right">Mapel</th><th className="text-right">Rata-rata</th></tr></thead>
                    <tbody>{p.nilai.map(n => <tr key={`${n.semester}-${n.jenis}`}><td>{n.semester}</td><td>{n.jenis}</td><td className="angka text-right">{n.mapel}</td><td className="angka text-right font-semibold">{n.rata.toLocaleString("id-ID")}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel judul="Riwayat Kelas" isi={false}>
              {p.riwayatKelas.length === 0 ? <p className={`px-5 py-4 ${kosong}`}>Belum ada riwayat kelas yang tercatat.</p> : (
                <ul className="divide-y divide-gray-100">
                  {p.riwayatKelas.map(r => <Baris key={r.id} kiri={r.className ?? ([r.grade ? `Kelas ${r.grade === 10 ? "X" : r.grade === 11 ? "XI" : r.grade === 12 ? "XII" : r.grade}` : "", r.majorName].filter(Boolean).join(" · ") || "Kelas tidak tercatat")} ket={r.status} kanan={r.academicYear.name} />)}
                </ul>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-6 xl:col-span-5">
            <Panel judul="PKL" tautan={p.pkl ? { label: "Pusat PKL", href: `/pusat-pkl/siswa/${s.id}` } : undefined}>
              {!p.pkl ? <p className={kosong}>Belum menjadi peserta PKL.</p> : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Isi label="Tempat">{penempatanBelumPasti(p.pkl.company) ? "Belum ditentukan" : p.pkl.company}</Isi></div>
                  <Isi label="Masa">{tgl(p.pkl.startDate, "short")} – {tgl(p.pkl.endDate, "short")}{p.pkl.lamaBulan ? ` (${p.pkl.lamaBulan} bulan)` : ""}</Isi>
                  <Isi label="Guru pembimbing">{p.pkl.teacher?.user.name}</Isi>
                  <Isi label="Jurnal ditulis">{p.pkl._count.journal} hari</Isi>
                  <Isi label="Nilai">{p.pkl.nilaiAkhirRata ?? p.pkl.nilaiIndustriRata ?? ""}</Isi>
                  <Isi label="Laporan akhir">{p.pkl.laporanAkhirStatus?.toLowerCase()}</Isi>
                  <Isi label="Sertifikat">{p.pkl.sertifikatNomor}</Isi>
                </dl>
              )}
            </Panel>

            <Panel judul="Poin & Prestasi" keterangan={`${p.jumlahPoin} catatan`} tautan={{ label: "Poin Siswa", href: "/dashboard/admin/student-points" }} isi={false}>
              {p.poin.length === 0 ? <p className={`px-5 py-4 ${kosong}`}>Belum ada catatan poin.</p> : (
                <ul className="divide-y divide-gray-100">
                  {p.poin.map(x => <Baris key={x.id} kiri={x.nama} ket={x.pelanggaran ? "Pelanggaran" : "Prestasi"} kanan={<><span className={x.pelanggaran ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{x.pelanggaran ? "−" : "+"}{x.poin}</span> · {tgl(x.tanggal, "short")}</>} />)}
                </ul>
              )}
            </Panel>

            <Panel judul="Surat & Layanan TU" isi={false}>
              {p.suratKet.length + p.legalisir.length + p.bantuan.length + p.rapor.length + p.ijazah.length === 0 && !d.sklNomor && !d.suratNo && !d.masukSuratNo
                ? <p className={`px-5 py-4 ${kosong}`}>Belum ada surat atau layanan yang tercatat untuk siswa ini.</p> : (
                <ul className="divide-y divide-gray-100">
                  {d.masukSuratNo && <Baris kiri="Surat penerimaan pindahan" ket={d.masukSuratNo} />}
                  {d.suratNo && <Baris kiri="Surat pindah / keluar" ket={d.suratNo} kanan={tgl(d.pindahDate, "short")} />}
                  {d.sklNomor && <Baris kiri="Surat Keterangan Lulus" ket={d.sklNomor} />}
                  {p.suratKet.map(x => <Baris key={x.id} kiri={`Surat keterangan: ${x.jenis}`} ket={[x.nomorSurat || (x.requestStatus ? `permintaan ${x.requestStatus.toLowerCase()}` : "belum bernomor"), x.keperluan].filter(Boolean).join(" · ")} kanan={tgl(x.tanggal, "short")} />)}
                  {p.legalisir.map(x => <Baris key={x.id} kiri={`Legalisir ${x.documentType}`} ket={`${x.copies} lembar · ${x.status.toLowerCase()}`} kanan={tgl(x.requestDate, "short")} />)}
                  {p.bantuan.map(x => <Baris key={x.id} kiri={`${x.jenis} ${x.tahun}${x.tahap ? ` tahap ${x.tahap}` : ""}`} ket={`${rp(x.nominal)} · ${x.statusAmbil.toLowerCase()}`} />)}
                  {p.rapor.map(x => <Baris key={x.id} kiri={`Rapor ${x.semester} diambil`} ket={x.diambilOleh} kanan={tgl(x.tanggalAmbil, "short")} />)}
                  {p.ijazah.map(x => <Baris key={x.id} kiri={`Ijazah diserahkan${x.nomorIjazah ? ` (${x.nomorIjazah})` : ""}`} ket={`${x.dokumen.join(", ")} · diterima ${x.pengambilNama}`} kanan={tgl(x.tanggalSerah, "short")} />)}
                </ul>
              )}
            </Panel>

            <Panel id="berkas" judul="Berkas Siswa" keterangan="dokumen pribadi — tersimpan tertutup" isi={false}>
              <BerkasSiswaPanel studentId={s.id} />
            </Panel>

            <Panel judul="Lainnya">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Isi label="Ekstrakurikuler">{p.ekskul.map(e => `${e.extracurricular.name}${e.role ? ` (${e.role})` : ""}`).join(", ")}</Isi></div>
                <div className="sm:col-span-2"><Isi label="Buku yang sedang dipinjam">{p.pinjaman.map(b => `${b.book.title} — kembali ${tgl(b.dueDate, "short")}`).join("; ")}</Isi></div>
                <Isi label="Kunjungan UKS">{p.uks ? `${p.uks} kali` : ""}</Isi>
                <Isi label="Catatan BK">{p.bk ? `${p.bk} catatan` : ""}</Isi>
                {p.tracer && <div className="sm:col-span-2"><Isi label="Tracer alumni">{[p.tracer.status, p.tracer.institutionName, p.tracer.position].filter(Boolean).join(" · ")} — diisi {tgl(p.tracer.surveyDate, "short")}</Isi></div>}
              </dl>
              <p className="mt-3 text-xs text-gray-500">Isi catatan BK dan pemeriksaan UKS tidak ditampilkan di sini; hanya jumlahnya. Rinciannya dibuka petugas BK dan UKS di menunya masing-masing.</p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
