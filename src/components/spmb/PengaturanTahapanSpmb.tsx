"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2, ArrowUp, ArrowDown, RotateCcw, Edit2 } from "lucide-react";
import TimePicker from "@/components/shared/TimePicker";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import ImageUpload from "@/components/admin/ImageUpload";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import {
  ASESMEN_BAWAAN, PAKTA_BAWAAN, PEMERIKSAAN_BAWAAN, KUNCI_BUKU_INDUK, bacaPakta, LABEL_JENIS, LABEL_SYARAT_BAYAR, bacaIsian, bacaMpls, bacaSetelanBayar, bacaSetelanSeragam, rupiah,
  LABEL_UNTUK_SERAGAM, type UntukSeragam, type InfoMpls, type SyaratBayar, type IsianTahap, type JenisIsian, type SetelanSeragam,
} from "@/lib/spmb-tahapan";

type Kirim = (url: string, method: string, body?: unknown) => Promise<boolean>;
type Toast = { success: (m: string) => void; error: (m: string) => void };

const BAGIAN = [
  { id: "umum", label: "Tahap & MPLS" },
  { id: "seragam", label: "Ukuran Seragam" },
  { id: "asesmen", label: "Pertanyaan Asesmen" },
  { id: "pemeriksaan", label: "Isian Fisik & Kesehatan" },
  { id: "sesi", label: "Sesi Kedatangan" },
  { id: "pakta", label: "Surat Pernyataan" },
] as const;

/** Tab "Tahapan Calon" di Pengaturan SPMB (6 Oktober 2026). Semua isian disusun panitia sendiri —
 *  daftar bawaan di kode hanya titik awal ("belum ada lembar yang dipakai" — user). */
export default function PengaturanTahapanSpmb({ setelan, sibuk, kirim, toast }: { setelan: Record<string, string>; sibuk: boolean; kirim: Kirim; toast: Toast }) {
  const [bagian, setBagian] = useState<(typeof BAGIAN)[number]["id"]>("umum");
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("bagian");
    if (b && BAGIAN.some(x => x.id === b)) queueMicrotask(() => setBagian(b as (typeof BAGIAN)[number]["id"]));
  }, []);
  async function simpan(isi: Record<string, string>) {
    if (await kirim("/api/spmb/pengaturan", "PUT", isi)) toast.success("Pengaturan tahapan tersimpan");
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {BAGIAN.map(b => (
          <button key={b.id} type="button" onClick={() => setBagian(b.id)}
            className={`sentuh rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${bagian === b.id ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>
            {b.label}
          </button>
        ))}
      </div>
      {bagian === "umum" && <BagianUmum setelan={setelan} sibuk={sibuk} simpan={simpan} />}
      {bagian === "seragam" && <BagianSeragam awal={bacaSetelanSeragam(setelan["spmb.seragam"])} sibuk={sibuk} simpan={simpan} />}
      {bagian === "asesmen" && (
        <EditorIsian key="asesmen" judul="Pertanyaan asesmen awal" kunci="spmb.asesmen" bawaan={ASESMEN_BAWAAN}
          awal={bacaIsian(setelan["spmb.asesmen"], ASESMEN_BAWAAN)} sibuk={sibuk} simpan={simpan}
          keterangan="Diisi panitia saat mewawancarai calon. Hasilnya menjadi catatan bagi wali kelas & BK setelah calon menjadi siswa." />
      )}
      {bagian === "sesi" && <BagianSesi toast={toast} />}
      {bagian === "pakta" && <BagianPakta setelan={setelan} sibuk={sibuk} simpan={simpan} />}
      {bagian === "pemeriksaan" && (
        <EditorIsian key="pemeriksaan" judul="Isian cek fisik & kesehatan" kunci="spmb.pemeriksaan" bawaan={PEMERIKSAAN_BAWAAN}
          awal={bacaIsian(setelan["spmb.pemeriksaan"], PEMERIKSAAN_BAWAAN)} sibuk={sibuk} simpan={simpan} bukuInduk
          keterangan="Isian yang dihubungkan ke Buku Induk otomatis mengisi data kesehatan siswa saat calon dijadikan siswa (menu Jadi Siswa). IMT dihitung otomatis dari tinggi & berat." />
      )}
    </div>
  );
}

function BagianUmum({ setelan, sibuk, simpan }: { setelan: Record<string, string>; sibuk: boolean; simpan: (x: Record<string, string>) => void }) {
  const [seleksi, setSeleksi] = useState(setelan["spmb.tahapSeleksi"] !== "0");
  const [daftarUlang, setDaftarUlang] = useState(setelan["spmb.tahapDaftarUlang"] !== "0");
  const [mpls, setMpls] = useState<InfoMpls>(bacaMpls(setelan["spmb.mpls"]));
  const awalBayar = bacaSetelanBayar(setelan);
  const [syarat, setSyarat] = useState<SyaratBayar>(awalBayar.syarat);
  const [uangMuka, setUangMuka] = useState(awalBayar.uangMuka ? String(awalBayar.uangMuka) : "");
  const [infoBayar, setInfoBayar] = useState(awalBayar.info);
  const set = (k: keyof InfoMpls, v: string) => setMpls(m => ({ ...m, [k]: v }));
  return (
    <>
      <div className="panel space-y-4 p-5">
        <div>
          <p className="panel-judul">Tahap yang dipakai</p>
          <p className="text-sm text-gray-500">
            Urutan tetap: Pendaftaran → Verifikasi Berkas → Ukuran Seragam → Asesmen Awal → Cek Fisik & Kesehatan → Pengumuman Hasil →
            Daftar Ulang → Resmi MPLS. Pembayaran berjalan terpisah (bisa dicicil). Jadwal tahap yang mengharuskan calon datang ke sekolah diisi per gelombang
            (tab Gelombang & Kuota → Edit).
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-1" checked={seleksi} onChange={e => setSeleksi(e.target.checked)} />
          <span><span className="font-semibold">Pengumuman Hasil (Diterima)</span><br />
            <span className="text-gray-500">Memakai Seleksi & Pengumuman yang sudah ada. Bila dimatikan, calon yang menuntaskan cek kesehatan otomatis berstatus diterima.</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-1" checked={daftarUlang} onChange={e => setDaftarUlang(e.target.checked)} />
          <span><span className="font-semibold">Daftar Ulang</span><br />
            <span className="text-gray-500">Calon menekan &ldquo;Saya bersedia daftar ulang&rdquo; (atau panitia atas namanya) dan syarat pembayaran di bawah terpenuhi.</span></span>
        </label>
      </div>

      <div className="panel space-y-4 p-5">
        <div>
          <p className="panel-judul">Pembayaran daftar ulang</p>
          <p className="text-sm text-gray-500">
            Pembayaran boleh langsung lunas, dicicil, atau setelah MPLS. Pendaftaran gratis; tagihan tiap calon = <span className="font-medium">Biaya daftar ulang gelombangnya</span> (tab
            Gelombang & Kuota). Gelombang tanpa biaya memakai jumlah Rincian Biaya di Isi Halaman Web{awalBayar.total ? ` (${rupiah(awalBayar.total)})` : ""}. Potongan per calon diatur di layar Tahapan Calon.
            Bukti yang dikirim calon disahkan panitia SPMB / superadmin.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Syarat untuk menuntaskan daftar ulang (ikut MPLS)</label>
            <Select value={syarat} onChange={v => setSyarat(v as SyaratBayar)}
              options={Object.entries(LABEL_SYARAT_BAYAR).map(([value, label]) => ({ value, label }))} />
          </div>
          {syarat === "UANG_MUKA" && (
            <div>
              <label className="label-field">Uang muka minimal (Rp)</label>
              <input className="input-field angka" inputMode="numeric" value={uangMuka ? Number(uangMuka).toLocaleString("id-ID") : ""}
                onChange={e => setUangMuka(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
        </div>
        <div>
          <label className="label-field">Cara bayar / nomor rekening</label>
          <textarea className="input-field min-h-[90px]" value={infoBayar} onChange={e => setInfoBayar(e.target.value)}
            placeholder={"Transfer ke Bank ... a.n. SMK Al-Munawwir IIBS, no. rek ...\nAtau bayar tunai di ruang TU, Senin–Sabtu 08.00–14.00"} />
          <p className="mt-1 text-xs text-gray-500">Tampil di kartu Pembayaran pada halaman tahapan calon.</p>
        </div>
      </div>

      <div className="panel space-y-4 p-5">
        <div>
          <p className="panel-judul">Informasi MPLS</p>
          <p className="text-sm text-gray-500">Tampil kepada calon begitu seluruh tahapan selesai, bersama ucapan resmi menjadi peserta MPLS.</p>
        </div>
        <div><label className="label-field">Nama kegiatan</label><input className="input-field" value={mpls.judul} onChange={e => set("judul", e.target.value)} /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label-field">Mulai</label><DatePicker value={mpls.mulai} onChange={v => set("mulai", v)} /></div>
          <div><label className="label-field">Selesai</label><DatePicker value={mpls.selesai} onChange={v => set("selesai", v)} /></div>
          <div><label className="label-field">Jam</label><input className="input-field" value={mpls.jam} onChange={e => set("jam", e.target.value)} placeholder="07.00–15.00 WIB" /></div>
        </div>
        <div><label className="label-field">Tempat</label><input className="input-field" value={mpls.tempat} onChange={e => set("tempat", e.target.value)} /></div>
        <div><label className="label-field">Keterangan</label><textarea className="input-field min-h-[80px]" value={mpls.keterangan} onChange={e => set("keterangan", e.target.value)} placeholder="Calon siswa datang diantar orang tua, memakai seragam SMP..." /></div>
        <div><label className="label-field">Perlengkapan yang dibawa</label><textarea className="input-field min-h-[80px]" value={mpls.perlengkapan} onChange={e => set("perlengkapan", e.target.value)} /></div>
      </div>

      <div className="flex justify-end">
        <button type="button" disabled={sibuk} className="btn-modal-save"
          onClick={() => simpan({
            "spmb.tahapSeleksi": seleksi ? "1" : "0", "spmb.tahapDaftarUlang": daftarUlang ? "1" : "0", "spmb.mpls": JSON.stringify(mpls),
            "spmb.syaratBayar": syarat, "spmb.uangMuka": uangMuka || "0", "spmb.infoBayar": infoBayar,
          })}>
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
        </button>
      </div>
    </>
  );
}

function BagianSeragam({ awal, sibuk, simpan }: { awal: SetelanSeragam; sibuk: boolean; simpan: (x: Record<string, string>) => void }) {
  const [s, setS] = useState<SetelanSeragam>(awal);
  const ubahItem = (i: number, f: (x: SetelanSeragam["item"][number]) => SetelanSeragam["item"][number]) =>
    setS(v => ({ ...v, item: v.item.map((x, k) => (k === i ? f(x) : x)) }));
  return (
    <>
      <div className="panel space-y-4 p-5">
        <div>
          <p className="panel-judul">Pilihan ukuran seragam</p>
          <p className="text-sm text-gray-500">Calon memilih satu ukuran untuk setiap item yang berlaku baginya. Tentukan tiap item untuk putra & putri, khusus putra (mis. Celana), atau khusus putri (mis. Rok) — calon hanya melihat item sesuai jenis kelaminnya, dan rekap pesanan menghitungnya terpisah.</p>
        </div>
        {s.item.map((item, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <input className="input-field flex-1 font-semibold" value={item.nama} placeholder="Nama item (mis. Baju Putih)"
                onChange={e => ubahItem(i, x => ({ ...x, nama: e.target.value }))} />
              <div className="w-44 shrink-0">
                <Select value={item.untuk ?? "SEMUA"} onChange={v => ubahItem(i, x => ({ ...x, untuk: v as UntukSeragam }))}
                  options={(Object.keys(LABEL_UNTUK_SERAGAM) as UntukSeragam[]).map(k => ({ value: k, label: LABEL_UNTUK_SERAGAM[k] }))} />
              </div>
              <button type="button" title="Hapus item" onClick={() => setS(v => ({ ...v, item: v.item.filter((_, k) => k !== i) }))}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            {item.ukuran.map((u, j) => (
              <div key={j} className="flex items-center gap-2">
                <input className="input-field w-24" value={u.label} placeholder="S / 30"
                  onChange={e => ubahItem(i, x => ({ ...x, ukuran: x.ukuran.map((y, k) => (k === j ? { ...y, label: e.target.value } : y)) }))} />
                <input className="input-field flex-1" value={u.keterangan} placeholder="Keterangan ukuran"
                  onChange={e => ubahItem(i, x => ({ ...x, ukuran: x.ukuran.map((y, k) => (k === j ? { ...y, keterangan: e.target.value } : y)) }))} />
                <button type="button" title="Hapus ukuran" onClick={() => ubahItem(i, x => ({ ...x, ukuran: x.ukuran.filter((_, k) => k !== j) }))}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => ubahItem(i, x => ({ ...x, ukuran: [...x.ukuran, { label: "", keterangan: "" }] }))} className="btn-modal-cancel btn-teks">
              <Plus size={16} /> Tambah Ukuran
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setS(v => ({ ...v, item: [...v.item, { nama: "", untuk: "SEMUA", ukuran: [{ label: "", keterangan: "" }] }] }))} className="btn-modal-cancel btn-teks">
          <Plus size={16} /> Tambah Item
        </button>
      </div>
      <div className="panel space-y-4 p-5">
        <div>
          <label className="label-field">Catatan untuk calon</label>
          <textarea className="input-field min-h-[120px]" value={s.catatan} onChange={e => setS(v => ({ ...v, catatan: e.target.value }))}
            placeholder={"Jadwal pemakaian seragam:\nSenin–Selasa: putih abu-abu\nRabu–Kamis: batik sekolah\n\nTata cara berseragam yang baik: ..."} />
          <p className="mt-1 text-xs text-gray-500">Mis. jadwal pemakaian seragam per hari dan tata cara berseragam yang baik.</p>
        </div>
        <ImageUpload value={s.gambar} onChange={v => setS(x => ({ ...x, gambar: v }))} folder="spmb" label="Gambar tabel ukuran (opsional)" />
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={sibuk} className="btn-modal-save"
          onClick={() => simpan({ "spmb.seragam": JSON.stringify({ ...s, item: s.item.filter(x => x.nama.trim()).map(x => ({ ...x, ukuran: x.ukuran.filter(u => u.label.trim()) })) }) })}>
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
        </button>
      </div>
    </>
  );
}

function EditorIsian({ judul, keterangan, kunci, awal, bawaan, sibuk, simpan, bukuInduk = false }: {
  judul: string; keterangan: string; kunci: string; awal: IsianTahap[]; bawaan: IsianTahap[]; sibuk: boolean;
  simpan: (x: Record<string, string>) => void; bukuInduk?: boolean;
}) {
  const confirm = useConfirm();
  const [daftar, setDaftar] = useState<IsianTahap[]>(awal);
  const ubah = (i: number, isi: Partial<IsianTahap>) => setDaftar(d => d.map((x, k) => (k === i ? { ...x, ...isi } : x)));
  const geser = (i: number, arah: -1 | 1) => setDaftar(d => {
    const j = i + arah;
    if (j < 0 || j >= d.length) return d;
    const b = [...d]; [b[i], b[j]] = [b[j], b[i]]; return b;
  });
  const idBaru = () => `isian${Date.now().toString(36)}`;

  return (
    <>
      <div className="panel space-y-4 p-5">
        <div>
          <p className="panel-judul">{judul}</p>
          <p className="text-sm text-gray-500">{keterangan} Jawaban yang sudah tersimpan tidak hilang walau pertanyaannya diubah atau dihapus.</p>
        </div>
        {daftar.map((x, i) => (
          <div key={x.id} className="space-y-3 rounded-xl border border-gray-100 p-4">
            <div className="flex items-start gap-2">
              <span className="angka mt-2.5 w-6 shrink-0 text-sm text-gray-400">{i + 1}.</span>
              <input className="input-field flex-1" value={x.label} placeholder="Pertanyaan / nama isian" onChange={e => ubah(i, { label: e.target.value })} />
              <div className="flex shrink-0">
                <button type="button" title="Naik" onClick={() => geser(i, -1)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"><ArrowUp size={14} /></button>
                <button type="button" title="Turun" onClick={() => geser(i, 1)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"><ArrowDown size={14} /></button>
                <button type="button" title="Hapus" onClick={() => setDaftar(d => d.filter((_, k) => k !== i))}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 pl-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label-field">Jenis jawaban</label>
                <Select value={x.jenis} onChange={v => ubah(i, { jenis: v as JenisIsian })}
                  options={Object.entries(LABEL_JENIS).map(([value, label]) => ({ value, label }))} />
              </div>
              <div>
                <label className="label-field">Kelompok</label>
                <input className="input-field" value={x.kelompok ?? ""} placeholder="Mis. Kesehatan" onChange={e => ubah(i, { kelompok: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Satuan</label>
                <input className="input-field" value={x.satuan ?? ""} placeholder="cm, kg" onChange={e => ubah(i, { satuan: e.target.value })} />
              </div>
              {bukuInduk && (
                <div>
                  <label className="label-field">Masuk Buku Induk</label>
                  <Select value={x.bukuInduk ?? ""} onChange={v => ubah(i, { bukuInduk: (v || undefined) as IsianTahap["bukuInduk"] })}
                    options={[{ value: "", label: "Tidak" }, ...Object.entries(KUNCI_BUKU_INDUK).map(([value, label]) => ({ value, label }))]} />
                </div>
              )}
            </div>
            {x.jenis === "PILIHAN" && (
              <div className="pl-8">
                <label className="label-field">Pilihan jawaban (pisahkan dengan koma)</label>
                <input className="input-field" value={(x.pilihan ?? []).join(", ")}
                  onChange={e => ubah(i, { pilihan: e.target.value.split(",").map(p => p.trim()) })} />
              </div>
            )}
            <label className="flex items-center gap-2 pl-8 text-sm text-gray-600">
              <input type="checkbox" checked={!!x.wajib} onChange={e => ubah(i, { wajib: e.target.checked })} /> Wajib diisi sebelum tahap diselesaikan
            </label>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDaftar(d => [...d, { id: idBaru(), label: "", jenis: "TEKS" }])} className="btn-modal-cancel btn-teks">
            <Plus size={16} /> Tambah Isian
          </button>
          <button type="button" className="btn-modal-cancel btn-teks"
            onClick={async () => { if (await confirm("Kembalikan ke daftar bawaan? Perubahan yang belum disimpan hilang.")) setDaftar(bawaan); }}>
            <RotateCcw size={16} /> Daftar Bawaan
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={sibuk} className="btn-modal-save"
          onClick={() => simpan({ [kunci]: JSON.stringify(daftar.filter(x => x.label.trim()).map(x => ({ ...x, pilihan: x.pilihan?.filter(Boolean) }))) })}>
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
        </button>
      </div>
    </>
  );
}

type Sesi = { id: string; tanggal: string; jamMulai: string; jamSelesai: string; tempat: string | null; catatan: string | null; kuota: number; terisi: number; sisa: number };
const SESI_KOSONG = { tanggal: "", jamMulai: "08:00", jamSelesai: "11:00", tempat: "", kuota: 30, catatan: "" };

/** Sesi kedatangan hari tes per gelombang — calon memilih sendiri di halaman tahapannya (kuota dijaga server). */
function BagianSesi({ toast }: { toast: Toast }) {
  const confirm = useConfirm();
  const [gelombang, setGelombang] = useState<{ id: string; nama: string }[]>([]);
  const [gid, setGid] = useState("");
  const [daftar, setDaftar] = useState<Sesi[]>([]);
  const [form, setForm] = useState<(typeof SESI_KOSONG & { id?: string }) | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    fetch("/api/spmb/gelombang").then(r => r.json())
      .then(d => { const g = (d?.gelombang ?? []) as { id: string; nama: string }[]; setGelombang(g); if (g[0]) setGid(x => x || g[0].id); })
      .catch(() => {});
  }, []);
  const muat = useCallback(() => {
    if (!gid) return;
    fetch(`/api/spmb/sesi?gelombangId=${gid}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setDaftar(d); }).catch(() => {});
  }, [gid]);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    if (!form) return;
    setSibuk(true);
    const r = await fetch(form.id ? `/api/spmb/sesi/${form.id}` : "/api/spmb/sesi", {
      method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, gelombangId: gid }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success("Sesi tersimpan"); setForm(null); muat(); } else toast.error(d?.error ?? "Gagal menyimpan");
  }

  async function hapus(x: Sesi) {
    if (!(await confirm(`Hapus sesi ${x.tanggal} ${x.jamMulai}?`))) return;
    const r = await fetch(`/api/spmb/sesi/${x.id}`, { method: "DELETE" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (r?.ok) { toast.success("Sesi dihapus"); muat(); } else toast.error(d?.error ?? "Gagal menghapus");
  }

  return (
    <div className="panel space-y-4 p-5">
      <div>
        <p className="panel-judul">Sesi kedatangan (asesmen & cek kesehatan)</p>
        <p className="text-sm text-gray-500">
          Calon memilih sesi sendiri di halaman tahapannya setelah memilih ukuran seragam, dan bisa menggantinya sampai asesmen dilakukan.
          Sesi yang penuh tidak bisa dipilih. Bila gelombang tidak punya sesi, calon melihat jadwal umum gelombang (Edit gelombang).
        </p>
      </div>
      <div className="baris-alat">
        <div className="alat-saring"><Select value={gid} onChange={setGid} options={gelombang.map(g => ({ value: g.id, label: g.nama }))} placeholder="Pilih gelombang" /></div>
        <div className="alat-aksi"><button type="button" disabled={!gid} onClick={() => setForm({ ...SESI_KOSONG })} className="btn-modal-save"><Plus size={16} /> Tambah Sesi</button></div>
      </div>

      {form && (
        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div><label className="label-field">Tanggal</label><DatePicker value={form.tanggal} onChange={v => setForm({ ...form, tanggal: v })} /></div>
            <div><label className="label-field">Jam mulai</label><TimePicker value={form.jamMulai} onChange={v => setForm({ ...form, jamMulai: v })} /></div>
            <div><label className="label-field">Jam selesai</label><TimePicker value={form.jamSelesai} onChange={v => setForm({ ...form, jamSelesai: v })} /></div>
            <div><label className="label-field">Kuota</label><input className="input-field angka" inputMode="numeric" value={form.kuota}
              onChange={e => setForm({ ...form, kuota: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label-field">Tempat</label><input className="input-field" value={form.tempat} onChange={e => setForm({ ...form, tempat: e.target.value })} placeholder="Aula SMK" /></div>
            <div><label className="label-field">Catatan</label><input className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Diantar orang tua, bawa berkas asli" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
            <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan</button>
          </div>
        </div>
      )}

      {daftar.length === 0 ? <p className="text-sm text-gray-400">Belum ada sesi di gelombang ini.</p> : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Tanggal</th><th>Jam</th><th>Tempat</th><th className="text-right">Terisi</th><th className="text-right">Aksi</th></tr></thead>
            <tbody>
              {daftar.map(x => (
                <tr key={x.id}>
                  <td className="angka">{x.tanggal}</td>
                  <td className="angka">{x.jamMulai}–{x.jamSelesai}</td>
                  <td>{x.tempat || "—"}</td>
                  <td className="angka text-right">{x.terisi} / {x.kuota}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" title="Edit" onClick={() => setForm({ id: x.id, tanggal: x.tanggal, jamMulai: x.jamMulai, jamSelesai: x.jamSelesai, tempat: x.tempat ?? "", kuota: x.kuota, catatan: x.catatan ?? "" })}
                        className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Edit2 size={14} /></button>
                      <button type="button" title="Hapus" onClick={() => hapus(x)}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Surat pernyataan / pakta integritas orang tua (7 Okt 2026) — ditandatangani di HP pada tahap daftar ulang.
 *  Mengubah teks TIDAK mengubah pakta yang sudah ditandatangani (tersimpan sebagai salinan per calon). */
function BagianPakta({ setelan, sibuk, simpan }: { setelan: Record<string, string>; sibuk: boolean; simpan: (x: Record<string, string>) => void }) {
  const confirm = useConfirm();
  const [p, setP] = useState(() => bacaPakta(setelan["spmb.pakta"]));
  return (
    <div className="panel space-y-4 p-5">
      <div>
        <p className="panel-judul">Surat pernyataan orang tua / wali</p>
        <p className="text-sm text-gray-500">
          Tampil di halaman tahapan calon saat tahap Daftar Ulang terbuka. Orang tua membaca, mengisi nama & hubungan, lalu menandatangani
          langsung di HP. Hasilnya bisa dicetak calon maupun panitia (ber-QR keaslian). Orang tua tanpa HP: cetak lembarnya dari jendela calon,
          lalu tandai &quot;Ditandatangani di Kertas&quot;.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={p.aktif} onChange={e => setP({ ...p, aktif: e.target.checked })} /> Pakai surat pernyataan
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={p.wajib} disabled={!p.aktif} onChange={e => setP({ ...p, wajib: e.target.checked })} />
        Wajib ditandatangani sebelum konfirmasi daftar ulang
      </label>
      <div><label className="label-field">Judul</label><input className="input-field" value={p.judul} onChange={e => setP({ ...p, judul: e.target.value })} /></div>
      <div>
        <label className="label-field">Isi pernyataan</label>
        <textarea className="input-field min-h-[280px] text-sm leading-relaxed" value={p.isi} onChange={e => setP({ ...p, isi: e.target.value })} />
        <p className="mt-1 text-xs text-gray-500">Tulis <code>{"{sekolah}"}</code> untuk nama sekolah. Pernyataan yang sudah ditandatangani tetap memakai teks saat ditandatangani.</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-modal-cancel"
          onClick={async () => { if (await confirm("Kembalikan judul & isi ke teks bawaan?")) setP({ ...p, judul: PAKTA_BAWAAN.judul, isi: PAKTA_BAWAAN.isi }); }}>
          <RotateCcw size={16} /> Teks Bawaan
        </button>
        <button type="button" disabled={sibuk} onClick={() => simpan({ "spmb.pakta": JSON.stringify(p) })} className="btn-modal-save">
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
        </button>
      </div>
    </div>
  );
}
