"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Save, Loader2, User, Home, Heart, GraduationCap, Users, Smile, Award,
  Trash2, Plus, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import Field from "@/components/admin/BukuIndukField";
import Section from "@/components/admin/BukuIndukSection";
import WilayahSelect from "@/components/admin/WilayahSelect";
import ImageUpload from "@/components/admin/ImageUpload";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";

interface Achievement { name: string; date: string; level: string; givenBy: string }
type BukuData = Record<string, unknown>;

interface StudentBiodata {
  id: string; nis: string; nisn: string | null;
  birthPlace: string | null; birthDate: string | null; gender: string | null; religion: string | null;
  address: string | null; parentName: string | null; parentPhone: string | null; parentJob: string | null;
  previousSchool: string | null;
  bukuIndukData: BukuData | null;
  class: { name: string } | null;
  major: { name: string } | null;
  profileEditRequests: { id: string; createdAt: string }[];
  history: { id: string; status: string; reviewNote: string | null; reviewedAt: string | null; createdAt: string; changes: Record<string, { label: string }> }[];
}

interface MasterEntry { category: string; items: string[] }

const dateInput = (v?: string | null): string => v ? v.slice(0, 10) : "";
const SAUDARA_OPTS = ["00 (Nol)", "01 (Satu)", "02 (Dua)", "03 (Tiga)", "04 (Empat)", "05 (Lima)", "06 (Enam)", "07 (Tujuh)", "08 (Delapan)", "09 (Sembilan)", "10 (Sepuluh)"];
const TINGKAT_PENGHARGAAN = ["Sekolah", "Kecamatan", "Kabupaten/Kota", "Provinsi", "Nasional", "Internasional"];

export default function StudentBiodataPage() {
  const [data, setData] = useState<StudentBiodata | null>(null);
  const [top, setTop] = useState<Record<string, string>>({});
  const [buku, setBuku] = useState<BukuData>({});
  const [masterData, setMasterData] = useState<MasterEntry[]>([]);
  const [sections, setSections] = useState<Record<string, boolean>>({ a: true });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const md = (cat: string): string[] => masterData.find(m => m.category === cat)?.items ?? [];

  function load() {
    fetch("/api/student/biodata").then(r => r.json()).then((d: StudentBiodata) => {
      setData(d);
      setTop({
        birthPlace: d.birthPlace ?? "", birthDate: dateInput(d.birthDate), gender: d.gender ?? "",
        religion: d.religion ?? "", address: d.address ?? "", parentName: d.parentName ?? "",
        parentPhone: d.parentPhone ?? "", parentJob: d.parentJob ?? "", previousSchool: d.previousSchool ?? "",
      });
      setBuku(d.bukuIndukData ?? {});
      setLoading(false);
    });
  }
  useEffect(() => {
    load();
    fetch("/api/student/master-data").then(r => r.json()).then(d => { if (Array.isArray(d)) setMasterData(d); }).catch(() => {});
  }, []);

  const f = (key: string) => {
    const v = buku[key];
    return Array.isArray(v) ? "" : String(v ?? "");
  };
  const setF = (key: string) => (v: string) => setBuku(p => ({ ...p, [key]: v }));
  const setAddrField = (key: string, fKey: string, mKey: string) => (v: string) =>
    setBuku(p => ({ ...p, [key]: v, [fKey]: v, [mKey]: v }));
  const toggleSection = (key: string) => setSections(p => (p[key] ? {} : { [key]: true }));

  const achievements: Achievement[] = Array.isArray(buku.achievements) ? buku.achievements as Achievement[] : [];
  const addAchievement = () => setBuku(p => ({ ...p, achievements: [...achievements, { name: "", date: "", level: "", givenBy: "" }] }));
  const removeAchievement = (idx: number) => setBuku(p => ({ ...p, achievements: achievements.filter((_, i) => i !== idx) }));
  const updateAchievement = (idx: number, field: keyof Achievement, val: string) =>
    setBuku(p => ({ ...p, achievements: achievements.map((a, i) => i === idx ? { ...a, [field]: val } : a) }));

  async function handleSubmit() {
    setError(""); setSuccess(false);
    setSubmitting(true);
    const res = await fetch("/api/student/biodata/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ top, buku }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(d.error ?? "Gagal mengajukan perubahan"); return; }
    setSuccess(true);
    load();
  }

  if (loading || !data) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  const pending = data.profileEditRequests[0];

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<User size={22} />}
        title="Biodata Saya"
        description={`${data.class?.name ?? "—"} · ${data.major?.name ?? "—"} · NIS ${data.nis}`}
        actions={
          <Link href="/dashboard/student" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition">
            <ArrowLeft size={18} />
          </Link>
        }
      />

      <div className="max-w-4xl space-y-4">
        {pending && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-amber-700 text-sm">
            <Clock size={18} className="shrink-0" />
            <div>
              <p className="font-semibold">Pengajuan perubahan sedang menunggu persetujuan admin</p>
              <p className="text-xs text-amber-600">Diajukan {new Date(pending.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} — data lama masih berlaku sampai disetujui.</p>
            </div>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 text-emerald-700 text-sm">
            <CheckCircle2 size={18} className="shrink-0" /> Pengajuan perubahan berhasil dikirim, menunggu persetujuan admin.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
        )}

        {data.history.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Riwayat Pengajuan</p>
            <div className="space-y-1.5">
              {data.history.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-xs">
                  {h.status === "APPROVED" ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <XCircle size={14} className="text-red-400 shrink-0" />}
                  <span className="text-gray-500">{new Date(h.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} —</span>
                  <span className={h.status === "APPROVED" ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                    {h.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                  </span>
                  <span className="text-gray-400">({Object.keys(h.changes).length} field)</span>
                  {h.reviewNote && <span className="text-gray-400 italic">— {h.reviewNote}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <fieldset disabled={!!pending} className={pending ? "opacity-60 pointer-events-none" : ""}>
          <div className="space-y-3">
            <Section title="A. Data Pribadi" icon={User} open={!!sections.a} onToggle={() => toggleSection("a")}>
              <div className="col-span-2">
                <ImageUpload value={f("fotoMasukUrl")} onChange={setF("fotoMasukUrl")} folder="buku-induk/masuk" label="Foto Diri"
                  accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3 / 4} />
              </div>
              <Field label="NIK (16 digit)" value={f("nik")} type="nik" onChange={setF("nik")} />
              <Field label="Panggilan" value={f("nickname")} onChange={setF("nickname")} />
              <Field label="Jenis Kelamin" value={top.gender} options={[{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }]}
                onChange={v => setTop(p => ({ ...p, gender: v }))} />
              <Field label="Tempat Lahir" value={top.birthPlace} onChange={v => setTop(p => ({ ...p, birthPlace: v }))} />
              <Field label="Tanggal Lahir" value={top.birthDate} type="date" onChange={v => setTop(p => ({ ...p, birthDate: v }))} />
              <Field label="Agama" value={top.religion} options={md("agama")} onChange={v => setTop(p => ({ ...p, religion: v }))} />
              <Field label="Kewarganegaraan" value={f("citizenship")} options={md("kewarganegaraan")} onChange={setF("citizenship")} />
              <Field label="Anak Ke-" value={f("childOrder")} options={md("jumlah_saudara")} onChange={setF("childOrder")} />
              <Field label="Jml Saudara Kandung" value={f("siblingsCount")} options={md("jumlah_saudara")} onChange={setF("siblingsCount")} />
              <Field label="Jml Saudara Tiri" value={f("halfSiblings")} options={SAUDARA_OPTS} onChange={setF("halfSiblings")} />
              <Field label="Jml Saudara Angkat" value={f("adoptedSiblings")} options={SAUDARA_OPTS} onChange={setF("adoptedSiblings")} />
              <Field label="Yatim/Piatu" value={f("orphanStatus")} options={md("yatim_piatu")} onChange={setF("orphanStatus")} />
              <Field label="Bahasa Sehari-hari" value={f("dailyLanguage")} options={md("bahasa")} onChange={setF("dailyLanguage")} />
            </Section>

            <Section title="B. Tempat Tinggal" icon={Home} open={!!sections.b} onToggle={() => toggleSection("b")}>
              <WilayahSelect
                province={f("province")} regency={f("kabupaten")} district={f("kecamatan")} village={f("desa")}
                onProvince={setAddrField("province", "fatherProvince", "motherProvince")}
                onRegency={setAddrField("kabupaten", "fatherKabupaten", "motherKabupaten")}
                onDistrict={setAddrField("kecamatan", "fatherKecamatan", "motherKecamatan")}
                onVillage={setAddrField("desa", "fatherDesa", "motherDesa")}
              />
              <Field label="Dusun/Lingkungan" value={f("dusun")} onChange={setAddrField("dusun", "fatherDusun", "motherDusun")} />
              <Field label="RT" value={f("rt")} options={md("rt")} onChange={setAddrField("rt", "fatherRt", "motherRt")} />
              <Field label="RW" value={f("rw")} options={md("rw")} onChange={setAddrField("rw", "fatherRw", "motherRw")} />
              <Field label="No. HP/Tlp Saya" value={f("studentPhone")} type="tel" onChange={setF("studentPhone")} />
              <Field label="No. HP/Tlp Orang Tua" value={top.parentPhone} type="tel" onChange={v => setTop(p => ({ ...p, parentPhone: v }))} />
              <Field label="Tinggal Dengan" value={f("livesWith")} options={md("tinggal_dengan")} onChange={setF("livesWith")} />
              <Field label="Jarak ke Sekolah" value={f("distanceToSchool")} options={md("jarak_sekolah")} onChange={setF("distanceToSchool")} />
            </Section>

            <Section title="C. Kesehatan" icon={Heart} open={!!sections.c} onToggle={() => toggleSection("c")} accent="text-rose-600">
              <Field label="Golongan Darah" value={f("bloodType")} options={md("golongan_darah")} onChange={setF("bloodType")} />
              <Field label="Tinggi Badan (cm)" value={f("height")} type="number" min={100} max={220} onChange={setF("height")} />
              <Field label="Berat Badan (kg)" value={f("weight")} type="number" min={20} max={200} onChange={setF("weight")} />
              <Field label="Penyakit yang Pernah Diderita" value={f("diseases")} type="textarea" wide onChange={setF("diseases")} />
            </Section>

            <Section title="D. Riwayat Sekolah Sebelumnya" icon={GraduationCap} open={!!sections.d} onToggle={() => toggleSection("d")}>
              <Field label="Asal Sekolah (SMP/MTs)" value={top.previousSchool} wide onChange={v => setTop(p => ({ ...p, previousSchool: v }))} />
              <Field label="Alamat Asal Sekolah" value={f("prevSchoolAddress")} wide onChange={setF("prevSchoolAddress")} />
              <Field label="Tanggal Ijazah" value={f("ijazahDate")} type="date" onChange={setF("ijazahDate")} />
              <Field label="Nomor Ijazah" value={f("ijazahNo")} onChange={setF("ijazahNo")} />
              <Field label="Tanggal SKHUN" value={f("skhunDate")} type="date" onChange={setF("skhunDate")} />
              <Field label="Lama Belajar" value={f("lamaBelajar")} options={md("lama_belajar")} onChange={setF("lamaBelajar")} />
              <Field label="Pindahan Dari" value={f("pindahanDari")} onChange={setF("pindahanDari")} />
              <Field label="Alasan Pindah ke SMK Ini" value={f("alasanPindahKe")} options={md("alasan_pindah")} onChange={setF("alasanPindahKe")} />
            </Section>

            <Section title="E. Keterangan Ayah" icon={Users} open={!!sections.e} onToggle={() => toggleSection("e")} accent="text-blue-600">
              <Field label="Nama Ayah Kandung" value={f("fatherName")} wide onChange={setF("fatherName")} />
              <Field label="NIK Ayah (16 digit)" value={f("fatherNik")} type="nik" onChange={setF("fatherNik")} />
              <Field label="Tempat Lahir Ayah" value={f("fatherBirthPlace")} onChange={setF("fatherBirthPlace")} />
              <Field label="Tanggal Lahir Ayah" value={f("fatherBirthDate")} type="date" onChange={setF("fatherBirthDate")} />
              <Field label="Agama" value={f("fatherReligion")} options={md("agama")} onChange={setF("fatherReligion")} />
              <Field label="Kewarganegaraan" value={f("fatherCitizenship")} options={md("kewarganegaraan")} onChange={setF("fatherCitizenship")} />
              <Field label="Pendidikan Terakhir" value={f("fatherEducation")} options={md("pendidikan_akhir")} onChange={setF("fatherEducation")} />
              <Field label="Pekerjaan" value={f("fatherJob")} options={md("pekerjaan")} onChange={setF("fatherJob")} />
              <Field label="Pengeluaran Bulanan" value={f("fatherIncome")} options={md("pengeluaran")} onChange={setF("fatherIncome")} />
              <div className="col-span-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5">
                Alamat mengikuti alamat siswa (Section B) — ubah di sana kalau perlu.
              </div>
              <Field label="Dusun/Lingkungan" value={f("fatherDusun")} onChange={setF("fatherDusun")} readOnly />
              <Field label="RT" value={f("fatherRt")} options={md("rt")} onChange={setF("fatherRt")} readOnly />
              <Field label="RW" value={f("fatherRw")} options={md("rw")} onChange={setF("fatherRw")} readOnly />
              <Field label="Masih Hidup / Telah Meninggal" value={f("fatherAlive")} options={md("status_ortu")} onChange={setF("fatherAlive")} />
            </Section>

            <Section title="F. Keterangan Ibu" icon={Users} open={!!sections.f} onToggle={() => toggleSection("f")} accent="text-pink-600">
              <Field label="Nama Ibu Kandung" value={f("motherName")} wide onChange={setF("motherName")} />
              <Field label="NIK Ibu (16 digit)" value={f("motherNik")} type="nik" onChange={setF("motherNik")} />
              <Field label="Tempat Lahir Ibu" value={f("motherBirthPlace")} onChange={setF("motherBirthPlace")} />
              <Field label="Tanggal Lahir Ibu" value={f("motherBirthDate")} type="date" onChange={setF("motherBirthDate")} />
              <Field label="Agama" value={f("motherReligion")} options={md("agama")} onChange={setF("motherReligion")} />
              <Field label="Kewarganegaraan" value={f("motherCitizenship")} options={md("kewarganegaraan")} onChange={setF("motherCitizenship")} />
              <Field label="Pendidikan Terakhir" value={f("motherEducation")} options={md("pendidikan_akhir")} onChange={setF("motherEducation")} />
              <Field label="Pekerjaan" value={f("motherJob")} options={md("pekerjaan")} onChange={setF("motherJob")} />
              <Field label="Pengeluaran Bulanan" value={f("motherIncome")} options={md("pengeluaran")} onChange={setF("motherIncome")} />
              <div className="col-span-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5">
                Alamat mengikuti alamat siswa (Section B) — ubah di sana kalau perlu.
              </div>
              <Field label="Dusun/Lingkungan" value={f("motherDusun")} onChange={setF("motherDusun")} readOnly />
              <Field label="RT" value={f("motherRt")} options={md("rt")} onChange={setF("motherRt")} readOnly />
              <Field label="RW" value={f("motherRw")} options={md("rw")} onChange={setF("motherRw")} readOnly />
              <Field label="Masih Hidup / Telah Meninggal" value={f("motherAlive")} options={md("status_ortu")} onChange={setF("motherAlive")} />
            </Section>

            <Section title="G. Keterangan Wali" icon={Users} open={!!sections.g} onToggle={() => toggleSection("g")} accent="text-violet-600">
              <Field label="Nama Wali" value={f("guardianName")} wide onChange={setF("guardianName")} />
              <Field label="NIK Wali (16 digit)" value={f("guardianNik")} type="nik" onChange={setF("guardianNik")} />
              <Field label="Tempat Lahir Wali" value={f("guardianBirthPlace")} onChange={setF("guardianBirthPlace")} />
              <Field label="Tanggal Lahir Wali" value={f("guardianBirthDate")} type="date" onChange={setF("guardianBirthDate")} />
              <Field label="Agama" value={f("guardianReligion")} options={md("agama")} onChange={setF("guardianReligion")} />
              <Field label="Kewarganegaraan" value={f("guardianCitizenship")} options={md("kewarganegaraan")} onChange={setF("guardianCitizenship")} />
              <Field label="Pendidikan Terakhir" value={f("guardianEducation")} options={md("pendidikan_akhir")} onChange={setF("guardianEducation")} />
              <Field label="Pekerjaan" value={f("guardianJob")} options={md("pekerjaan")} onChange={setF("guardianJob")} />
              <Field label="Pengeluaran Bulanan" value={f("guardianIncome")} options={md("pengeluaran")} onChange={setF("guardianIncome")} />
              <Field label="Dusun/Lingkungan" value={f("guardianDusun")} onChange={setF("guardianDusun")} />
              <Field label="RT" value={f("guardianRt")} options={md("rt")} onChange={setF("guardianRt")} />
              <Field label="RW" value={f("guardianRw")} options={md("rw")} onChange={setF("guardianRw")} />
              <Field label="No. HP/Tlp Wali" value={f("guardianPhone")} type="tel" onChange={setF("guardianPhone")} />
            </Section>

            <Section title="H. Kegemaran" icon={Smile} open={!!sections.h} onToggle={() => toggleSection("h")} accent="text-amber-600">
              <Field label="Kesenian" value={f("hobbyArt")} options={md("kesenian")} onChange={setF("hobbyArt")} />
              <Field label="Olahraga" value={f("hobbySport")} options={md("olahraga")} onChange={setF("hobbySport")} />
              <Field label="Organisasi" value={f("hobbyOrg")} options={md("organisasi")} onChange={setF("hobbyOrg")} />
              <Field label="Lainnya" value={f("hobbyOther")} onChange={setF("hobbyOther")} />
            </Section>

            <Section title="I. Prestasi & Penghargaan" icon={Award} open={!!sections.i} onToggle={() => toggleSection("i")} accent="text-yellow-600">
              <div className="col-span-2 space-y-3">
                {achievements.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Belum ada data penghargaan/prestasi</p>
                ) : achievements.map((a, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2 relative">
                    <button type="button" onClick={() => removeAchievement(idx)} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                    <div className="col-span-2 pr-6">
                      <label className="label-field">Nama Penghargaan</label>
                      <input className="input-field" value={a.name} onChange={e => updateAchievement(idx, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className="label-field">Tanggal</label>
                      <DatePicker value={a.date} onChange={v => updateAchievement(idx, "date", v)} />
                    </div>
                    <div>
                      <label className="label-field">Tingkat</label>
                      <select className="input-field" value={a.level} onChange={e => updateAchievement(idx, "level", e.target.value)}>
                        <option value="">— Pilih —</option>
                        {TINGKAT_PENGHARGAAN.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label-field">Diberikan Oleh</label>
                      <input className="input-field" value={a.givenBy} onChange={e => updateAchievement(idx, "givenBy", e.target.value)} />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addAchievement} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium">
                  <Plus size={14} /> Tambah Penghargaan
                </button>
              </div>
            </Section>
          </div>
        </fieldset>

        {!pending && (
          <div className="sticky bottom-4 flex justify-end">
            <button onClick={handleSubmit} disabled={submitting}
              className="btn-gold flex items-center gap-2 text-sm shadow-lg">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Ajukan Perubahan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
