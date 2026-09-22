"use client";
import { useEffect, useMemo, useState } from "react";
import { FileStack, Wand2, ChevronDown, UserSearch, Lock } from "lucide-react";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import StudentPicker, { type LookupStudent } from "@/components/admin/StudentPicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { TEMPLATE_SURAT, KATEGORI_TEMPLATE, type TemplateSurat } from "@/lib/template-surat";
import {
  bacaIsian, butuhSiswa, butuhGuru, nilaiAwal, terapkan,
  type Isian, type KonteksSekolah, type SiswaTemplate, type GuruTemplate,
} from "@/lib/template-isian";

interface LookupGuru {
  id: string; name: string; nip: string | null; position: string; subject: string | null;
  birthPlace: string | null; birthDate: string | null; address: string | null;
  nik: string | null; startDate: string | null;
}

/** Pemilih template dua tingkat (KATEGORI → JENIS) yang dilanjutkan FORMULIR ISIAN.
 *
 * Isi formulirnya tidak didaftar manual per template — dibaca dari tanda [SEPERTI INI] di dalam
 * templatenya sendiri (lihat src/lib/template-isian.ts). Bagian identitas siswa terisi otomatis
 * begitu nama siswa dipilih, dan bagian yang selalu sama (kepala sekolah, tahun pelajaran)
 * terisi sendiri dari pengaturan sekolah. */
export default function TemplateSuratPicker({
  onPakai, adaIsi = false, templateAwal, isiAwal,
}: {
  onPakai: (t: TemplateSurat, html: string, pihak: string, isi: Record<string, string>) => void;
  adaIsi?: boolean;
  /** Pilihan template & isian dari surat yang sedang diedit — dipulihkan supaya tidak perlu
   * memilih ulang dari nol setiap kali surat lama dibuka (temuan user 13 September 2026). */
  templateAwal?: string | null;
  isiAwal?: Record<string, string> | null;
}) {
  const confirmDialog = useConfirm();
  const [buka, setBuka] = useState(false);
  const [kategori, setKategori] = useState("");
  const [nilaiTemplate, setNilaiTemplate] = useState("");
  const [konteks, setKonteks] = useState<KonteksSekolah>({ kepalaSekolah: "", tahunPelajaran: "" });
  const [siswa, setSiswa] = useState<LookupStudent | null>(null);
  const [guru, setGuru] = useState<LookupGuru | null>(null);
  const [daftarGuru, setDaftarGuru] = useState<LookupGuru[]>([]);
  const [dipulihkan, setDipulihkan] = useState(false);
  const [isi, setIsi] = useState<Record<string, string>>({});

  // Pulihkan pilihan template & isian milik surat yang sedang diedit.
  useEffect(() => {
    if (dipulihkan || !templateAwal) return;
    setDipulihkan(true);
    const t = TEMPLATE_SURAT.find(x => x.value === templateAwal);
    if (!t) return;
    setKategori(t.kategori);
    setNilaiTemplate(t.value);
    if (isiAwal) setIsi(isiAwal);
    setBuka(true);
  }, [templateAwal, isiAwal, dipulihkan]);

  useEffect(() => {
    fetch("/api/admin/pegawai-lookup").then(r => r.json())
      .then(d => setDaftarGuru(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/surat/konteks").then(r => r.json())
      .then(d => setKonteks({ kepalaSekolah: d.kepalaSekolah ?? "", tahunPelajaran: d.tahunPelajaran ?? "" }))
      .catch(() => {});
  }, []);

  const subJenis = useMemo(
    () => TEMPLATE_SURAT.filter(t => !kategori || t.kategori === kategori), [kategori]);
  const terpilih = useMemo(
    () => TEMPLATE_SURAT.find(t => t.value === nilaiTemplate), [nilaiTemplate]);
  const isian: Isian[] = useMemo(
    () => (terpilih ? bacaIsian(terpilih.html + " " + terpilih.perihal + " " + terpilih.pihak, terpilih.subjek) : []),
    [terpilih]);
  const perluSiswa = butuhSiswa(isian);
  const perluGuru = butuhGuru(isian);

  /** Setiap ganti template (atau ganti siswa), formulirnya disusun ulang. */
  useEffect(() => {
    if (!terpilih) { setIsi({}); return; }
    const subjekData = (terpilih.subjek === "guru" ? guru : siswa) as SiswaTemplate | GuruTemplate | null;
    setIsi(lama => {
      const baru = nilaiAwal(isian, subjekData, konteks);
      // Ketikan yang sudah terlanjur diisi dipertahankan supaya tidak hilang saat memilih siswa.
      for (const k of Object.keys(baru)) if (!baru[k] && lama[k]) baru[k] = lama[k];
      return baru;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terpilih, siswa, guru, konteks]);

  const manual = isian.filter(i => i.jenis === "manual");
  const otomatis = isian.filter(i => i.jenis !== "manual");
  const belumTerisi = isian.filter(i => !(isi[i.tanda] ?? "").trim()).length;

  async function pakai() {
    if (!terpilih) return;
    if (adaIsi && !(await confirmDialog("Isi surat yang sekarang akan diganti. Lanjutkan?"))) return;
    onPakai(
      terpilih,
      terapkan(terpilih.html, isi, isian),
      terapkan(terpilih.pihak, isi, isian),
      isi,
    );
    setBuka(false);
  }

  return (
    <div className="panel overflow-hidden">
      <button type="button" onClick={() => setBuka(b => !b)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition">
        <FileStack size={16} className="text-primary-500 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-primary-900">Mulai dari Template Surat</span>
          <span className="block text-xs text-gray-400">
            {TEMPLATE_SURAT.length} contoh surat dari arsip sekolah — pilih jenisnya, isi formulirnya, suratnya terbentuk sendiri
          </span>
        </span>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${buka ? "rotate-180" : ""}`} />
      </button>

      {buka && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label-field">Kategori Surat</label>
              <Select value={kategori} onChange={v => { setKategori(v); setNilaiTemplate(""); }}
                placeholder="Semua kategori"
                options={[{ value: "", label: `Semua kategori (${TEMPLATE_SURAT.length})` },
                  ...KATEGORI_TEMPLATE.map(k => ({
                    value: k, label: `${k} (${TEMPLATE_SURAT.filter(t => t.kategori === k).length})` }))]} />
            </div>
            <div>
              <label className="label-field">Jenis Surat</label>
              <Select value={nilaiTemplate} onChange={setNilaiTemplate} placeholder="Pilih jenis surat..."
                options={subJenis.map(t => ({
                  value: t.value, label: kategori ? t.label : `${t.kategori} — ${t.label}` }))} />
            </div>
          </div>

          {terpilih && (
            <>
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-3">
                <p className="text-sm font-semibold text-primary-900">{terpilih.label}</p>
                <p className="text-xs text-primary-700 mt-0.5">{terpilih.keterangan}</p>
              </div>

              {perluSiswa && (
                <div>
                  <label className="label-field flex items-center gap-1.5">
                    <UserSearch size={13} /> Pilih Siswa — identitasnya terisi otomatis
                  </label>
                  <StudentPicker value={siswa} onChange={setSiswa} />
                </div>
              )}

              {perluGuru && (
                <div>
                  <label className="label-field flex items-center gap-1.5">
                    <UserSearch size={13} /> Pilih Pegawai — NIP, jabatan, dan mata pelajarannya terisi otomatis
                  </label>
                  <Select value={guru?.id ?? ""} onChange={v => setGuru(daftarGuru.find(g => g.id === v) ?? null)}
                    placeholder="Cari nama guru / pegawai..."
                    options={daftarGuru.map(g => ({ value: g.id, label: `${g.name}${g.nip ? ` — ${g.nip}` : ""}` }))} />
                </div>
              )}

              {otomatis.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                    <Lock size={12} /> Terisi otomatis
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {otomatis.map(i => (
                      <div key={i.tanda} className="text-xs">
                        <span className="text-gray-400">{i.label}: </span>
                        {isi[i.tanda]
                          ? <span className="font-semibold text-primary-900">{isi[i.tanda]}</span>
                          : <span className="text-amber-600">
                              {i.jenis === "siswa" ? "pilih siswa dulu" : "belum diatur"}
                            </span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {manual.length > 0 && (
                <div>
                  <p className="label-field mb-2">Yang perlu diisi ({manual.length})</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {manual.map(i => (
                      <div key={i.tanda} className={i.tipe === "panjang" ? "sm:col-span-2" : ""}>
                        <label className="label-field">{i.label}</label>
                        {i.tipe === "tanggal" ? (
                          <DatePicker value={isi[i.tanda] ?? ""}
                            onChange={v => setIsi(x => ({ ...x, [i.tanda]: v }))} />
                        ) : i.tipe === "panjang" ? (
                          <textarea rows={2} value={isi[i.tanda] ?? ""}
                            onChange={e => setIsi(x => ({ ...x, [i.tanda]: e.target.value }))}
                            className="input-field w-full" />
                        ) : (
                          <input value={isi[i.tanda] ?? ""}
                            onChange={e => setIsi(x => ({ ...x, [i.tanda]: e.target.value }))}
                            placeholder={i.tipe === "jam" ? "08.00" : ""}
                            className="input-field w-full" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  {belumTerisi === 0
                    ? "Semua bagian sudah terisi."
                    : `${belumTerisi} bagian belum diisi — yang kosong tetap ditandai kurung siku di lembar kerja supaya tidak terlewat.`}
                </p>
                <button type="button" onClick={pakai} className="btn-modal-save shrink-0">
                  <Wand2 size={15} /> Buat Suratnya
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
