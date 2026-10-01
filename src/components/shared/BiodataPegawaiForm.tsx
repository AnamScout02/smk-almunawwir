"use client";
import { useEffect, useState } from "react";
import {
  Save, Loader2, IdCard, Home, HeartPulse, GraduationCap, Users, Baby, Medal,
  Clock, CheckCircle2, XCircle, AlertTriangle, HeartHandshake,
} from "lucide-react";
import Field from "@/components/admin/BukuIndukField";
import Section from "@/components/admin/BukuIndukSection";
import IsianGrupGuru from "@/components/admin/IsianGrupGuru";
import WilayahSelect from "@/components/admin/WilayahSelect";
import PageHeader from "@/components/admin/PageHeader";

interface MasterEntry { category: string; items: string[] }
interface Riwayat {
  id: string; status: string; reviewNote: string | null; reviewedAt: string | null;
  createdAt: string; changes: Record<string, { label: string; ditolak?: boolean }>;
}
interface Biodata {
  sumber: "teacher" | "pegawai";
  identitas: {
    nama: string; email: string; peran: string; nip: string | null; mapel: string | null;
    statusKepegawaian: string | null; jabatan: string[];
  };
  top: Record<string, string>;
  buku: Record<string, unknown>;
  pending: { id: string; createdAt: string } | null;
  history: Riwayat[];
}

const tanggalPanjang = (v: string) =>
  new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export default function BiodataPegawaiForm() {
  const [data, setData] = useState<Biodata | null>(null);
  const [top, setTop] = useState<Record<string, string>>({});
  const [buku, setBuku] = useState<Record<string, unknown>>({});
  const [master, setMaster] = useState<MasterEntry[]>([]);
  const [sections, setSections] = useState<Record<string, boolean>>({ a: true });
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  const md = (kategori: string): string[] => master.find(m => m.category === kategori)?.items ?? [];

  function muat() {
    fetch("/api/pegawai/biodata")
      .then(r => r.json())
      .then((d: Biodata & { error?: string }) => {
        if (d.error) { setGalat(d.error); return; }
        setData(d);
        setTop(d.top ?? {});
        setBuku(d.buku ?? {});
      })
      .catch(() => setGalat("Gagal memuat biodata. Periksa sambungan lalu muat ulang halaman."))
      .finally(() => setMemuat(false));
  }
  useEffect(() => {
    muat();
    fetch("/api/pegawai/master-data").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMaster(d); }).catch(() => {});
  }, []);

  const e = (k: string) => {
    const v = buku[k];
    return v === null || v === undefined ? "" : String(v);
  };
  const setE = (k: string) => (v: string) => setBuku(p => ({ ...p, [k]: v }));
  const t = (k: string) => top[k] ?? "";
  const setT = (k: string) => (v: string) => setTop(p => ({ ...p, [k]: v }));
  const buka = (k: string) => setSections(p => (p[k] ? {} : { [k]: true }));

  async function kirim() {
    setGalat(""); setBerhasil(false); setMengirim(true);
    const res = await fetch("/api/pegawai/biodata/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ top, buku }),
    }).catch(() => null);
    setMengirim(false);
    if (!res) { setGalat("Gagal menghubungi server. Coba lagi."); return; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setGalat(d.error ?? "Gagal mengajukan perubahan"); return; }
    setBerhasil(true);
    muat();
  }

  if (memuat) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<IdCard size={22} />} title="Biodata Saya" description="Data kepegawaian Anda" />
        <p className="py-10 text-center text-sm text-gray-400">{galat || "Biodata tidak ditemukan."}</p>
      </div>
    );
  }

  const menunggu = data.pending;
  const id = data.identitas;
  const keterangan = [id.nip ? `NIP ${id.nip}` : null, id.mapel, id.jabatan[0]]
    .filter(Boolean).join(" · ") || id.email;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<IdCard size={22} />} title="Biodata Saya" description={keterangan} />

      <div className="max-w-4xl space-y-4">
        {data.sumber === "pegawai" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3 text-blue-700 text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Anda belum tercatat di Buku Induk Guru &amp; Tenaga Kependidikan</p>
              <p className="text-xs text-blue-600">
                Biodata yang Anda isi di sini tetap tersimpan dan ikut dipindahkan otomatis begitu
                Tata Usaha membuatkan data kepegawaian Anda. NIP, status kepegawaian, dan jabatan
                tetap diisi Tata Usaha.
              </p>
            </div>
          </div>
        )}

        {menunggu && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3 text-amber-700 text-sm">
            <Clock size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Pengajuan perubahan sedang menunggu persetujuan Tata Usaha</p>
              <p className="text-xs text-amber-600">
                Diajukan {tanggalPanjang(menunggu.createdAt)} — data lama masih berlaku sampai disetujui.
              </p>
            </div>
          </div>
        )}

        {berhasil && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 text-emerald-700 text-sm">
            <CheckCircle2 size={18} className="shrink-0" /> Pengajuan perubahan terkirim, menunggu persetujuan Tata Usaha.
          </div>
        )}
        {galat && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{galat}</div>}

        <div className="panel p-4">
          <p className="label-kecil mb-2 text-gray-400">Data yang hanya bisa diubah Tata Usaha</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
            {[
              ["Nama", id.nama],
              ["NIP", id.nip ?? "—"],
              ["Mata Pelajaran", id.mapel ?? "—"],
              ["Status Kepegawaian", id.statusKepegawaian ?? "—"],
              ["Jabatan Struktural", id.jabatan.length ? id.jabatan.join(", ") : "—"],
              ["Email Akun", id.email],
            ].map(([label, nilai]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="truncate font-medium text-primary-900">{nilai}</p>
              </div>
            ))}
          </div>
        </div>

        {data.history.length > 0 && (
          <div className="panel p-4">
            <p className="label-kecil mb-2 text-gray-400">Riwayat Pengajuan</p>
            <div className="space-y-1.5">
              {data.history.map(h => {
                const isian = Object.values(h.changes);
                const ditolak = isian.filter(c => c.ditolak);
                const sebagian = h.status === "SEBAGIAN";
                return (
                  <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                    {h.status === "REJECTED"
                      ? <XCircle size={14} className="shrink-0 text-red-400" />
                      : sebagian
                        ? <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                        : <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />}
                    <span className="text-gray-500">{tanggalPanjang(h.createdAt)} —</span>
                    <span className={h.status === "REJECTED" ? "font-medium text-red-500" : sebagian ? "font-medium text-amber-600" : "font-medium text-emerald-600"}>
                      {h.status === "REJECTED" ? "Ditolak" : sebagian ? `${isian.length - ditolak.length} disetujui, ${ditolak.length} ditolak` : "Disetujui"}
                    </span>
                    {!sebagian && <span className="text-gray-400">({isian.length} isian)</span>}
                    {ditolak.length > 0 && <span className="text-gray-400">ditolak: {ditolak.map(c => c.label).join(", ")}</span>}
                    {h.reviewNote && <span className="italic text-gray-400">— {h.reviewNote}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <fieldset disabled={!!menunggu} className={menunggu ? "pointer-events-none opacity-60" : ""}>
          <div className="space-y-3">
            <Section title="A. Identitas Pribadi" icon={IdCard} open={!!sections.a} onToggle={() => buka("a")}>
              <Field label="NIK (16 digit)" value={e("nik")} type="nik" onChange={setE("nik")} />
              <Field label="Jenis Kelamin" value={t("gender")} onChange={setT("gender")}
                options={[{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }]} />
              <Field label="Tempat Lahir" value={t("birthPlace")} onChange={setT("birthPlace")} />
              <Field label="Tanggal Lahir" value={t("birthDate")} type="date" onChange={setT("birthDate")} />
              <Field label="Agama" value={t("religion")} options={md("agama")} onChange={setT("religion")} />
              <IsianGrupGuru grup="Identitas" e={e} setE={setE} />
            </Section>

            <Section title="B. Alamat & Tempat Tinggal" icon={Home} open={!!sections.b} onToggle={() => buka("b")}>
              <WilayahSelect
                province={e("province")} regency={e("kabupaten")} district={e("kecamatan")} village={e("desa")}
                onProvince={setE("province")} onRegency={setE("kabupaten")}
                onDistrict={setE("kecamatan")} onVillage={setE("desa")}
              />
              <IsianGrupGuru grup="Alamat" e={e} setE={setE} />
              <Field label="Alamat Lengkap" value={t("address")} type="textarea" wide onChange={setT("address")} />
              <Field label="No. HP/Telepon" value={t("phone")} type="tel" onChange={setT("phone")} />
              <IsianGrupGuru grup="Tempat Tinggal" e={e} setE={setE} />
            </Section>

            <Section title="C. Kesehatan" icon={HeartPulse} open={!!sections.c} onToggle={() => buka("c")} accent="text-rose-600">
              <IsianGrupGuru grup="Kesehatan" e={e} setE={setE} />
            </Section>

            <Section title="D. Riwayat Pendidikan" icon={GraduationCap} open={!!sections.d} onToggle={() => buka("d")}>
              <Field label="Pendidikan Terakhir" value={t("education")}
                options={md("pendidikan_guru").length ? md("pendidikan_guru") : md("pendidikan_akhir")}
                onChange={setT("education")} />
              <IsianGrupGuru grup="Riwayat Pendidikan" e={e} setE={setE} />
            </Section>

            <Section title="E. Perkawinan" icon={HeartHandshake} open={!!sections.e} onToggle={() => buka("e")} accent="text-violet-600">
              <Field label="Status Kawin" value={e("maritalStatus")} onChange={setE("maritalStatus")}
                options={["Belum Kawin", "Kawin", "Janda/Duda"]} />
              <Field label="Nama Pasangan" value={e("spouseName")} onChange={setE("spouseName")} />
              <IsianGrupGuru grup="Perkawinan" e={e} setE={setE} />
            </Section>

            <Section title="F. Ibu Kandung" icon={Users} open={!!sections.f} onToggle={() => buka("f")} accent="text-pink-600">
              <IsianGrupGuru grup="Ibu Kandung" e={e} setE={setE} />
            </Section>

            <Section title="G. Anak" icon={Baby} open={!!sections.g} onToggle={() => buka("g")} accent="text-blue-600">
              <IsianGrupGuru grup="Anak" e={e} setE={setE} />
            </Section>

            <Section title="H. Penghargaan" icon={Medal} open={!!sections.h} onToggle={() => buka("h")} accent="text-amber-600">
              <IsianGrupGuru grup="Penghargaan" e={e} setE={setE} />
            </Section>
          </div>
        </fieldset>

        {!menunggu && (
          <div className="sticky bottom-4 flex justify-end">
            <button onClick={kirim} disabled={mengirim} className="btn-modal-save shadow-lg">
              {mengirim ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Ajukan Perubahan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
