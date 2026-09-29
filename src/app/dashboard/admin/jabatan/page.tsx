"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Loader2, Plus, Edit2, Trash2, Save, TriangleAlert, Users, Search, UserCog } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Pemegang { id: string; nama: string; jenis: "guru" | "staf"; nonaktif: boolean }
interface Orang { id: string; nama: string; nonaktif?: boolean; role?: string }
interface JabatanItem {
  id: string;
  name: string;
  _count: { teachers: number; staff: number };
  pemegang: Pemegang[];
}
interface Staf { id: string; name: string; email: string }

export default function AdminJabatanPage() {
  const confirmDialog = useConfirm();
  const [items, setItems] = useState<JabatanItem[]>([]);
  const [tanpaJabatan, setTanpaJabatan] = useState<Staf[]>([]);
  const [cari, setCari] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<JabatanItem | null>(null);
  /* Kelola pemegang LANGSUNG dari katalog — arah kebalikan dari halaman orang ("jabatan apa saja
     milik orang ini"). Tanpa ini halaman Jabatan hanya bisa dilihat dan petugas harus mencari
     orangnya lagi di Akun Pengguna / Buku Induk Guru (keluhan user 29 September 2026). */
  const [pemegangModal, setPemegangModal] = useState<JabatanItem | null>(null);
  const [kandidat, setKandidat] = useState<{ guru: Orang[]; staf: Orang[] } | null>(null);
  const [pilihGuru, setPilihGuru] = useState<string[]>([]);
  const [pilihStaf, setPilihStaf] = useState<string[]>([]);
  const [cariOrang, setCariOrang] = useState("");
  const [simpanPemegang, setSimpanPemegang] = useState(false);
  const [ingatStruktur, setIngatStruktur] = useState<{ role: string; name: string }[]>([]);

  async function bukaPemegang(item: JabatanItem) {
    setPemegangModal(item); setKandidat(null); setCariOrang(""); setError(""); setIngatStruktur([]);
    const d = await fetch(`/api/admin/jabatan/${item.id}/pemegang`).then(r => r.json()).catch(() => null);
    if (!d || d.error) { setError(d?.error ?? "Gagal memuat daftar orang."); return; }
    setKandidat({ guru: d.guru, staf: d.staf });
    setPilihGuru(d.guruIds); setPilihStaf(d.stafIds);
  }

  async function simpanPemegangJabatan() {
    if (!pemegangModal) return;
    setSimpanPemegang(true);
    const res = await fetch(`/api/admin/jabatan/${pemegangModal.id}/pemegang`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guruIds: pilihGuru, stafIds: pilihStaf }),
    }).catch(() => null);
    setSimpanPemegang(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      setError(d?.error ?? "Gagal menyimpan pemegang jabatan.");
      return; // modal dibiarkan terbuka supaya centangnya tidak hilang
    }
    const d = await res.json().catch(() => null);
    setIngatStruktur(Array.isArray(d?.struktur) ? d.struktur : []);
    setPemegangModal(null);
    load();
  }
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/jabatan?pemegang=1").then(r => r.json()).catch(() => []),
      fetch("/api/admin/jabatan/tanpa-jabatan").then(r => r.json()).catch(() => null),
    ])
      .then(([d, t]) => {
        setItems(Array.isArray(d) ? d : []);
        setTanpaJabatan(Array.isArray(t?.staf) ? t.staf : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setName(""); setError(""); setModal(true); }
  function openEdit(item: JabatanItem) { setEditing(item); setName(item.name); setError(""); setModal(true); }

  async function handleSave() {
    if (!name.trim()) { setError("Nama jabatan wajib diisi."); return; }
    setSaving(true);
    const res = editing
      ? await fetch(`/api/admin/jabatan/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      : await fetch("/api/admin/jabatan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  async function handleDelete(item: JabatanItem) {
    const jml = item._count.teachers + item._count.staff;
    if (!await confirmDialog(`Hapus jabatan "${item.name}"?${jml > 0 ? ` Akan dilepas dari ${jml} orang.` : ""}`)) return;
    await fetch(`/api/admin/jabatan/${item.id}`, { method: "DELETE" });
    load();
  }

  const q = cari.trim().toLowerCase();
  const tersaring = q
    ? items.filter(i => i.name.toLowerCase().includes(q) || i.pemegang.some(p => p.nama.toLowerCase().includes(q)))
    : items;
  const kosong = items.filter(i => i.pemegang.length === 0).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Award size={22} />}
        title="Jabatan"
        description="Katalog jabatan struktural: buat/ubah nama jabatan dan atur siapa pemegangnya. Menu di portal guru & staf menyala mengikuti jabatan ini, bukan mengikuti peran akun."
      />

      {/* Staf tanpa jabatan = tidak punya menu tugas apa pun. Ditaruh paling atas karena ini
          pemberitahuan yang perlu tindakan (DESIGN_SYSTEM §19.5). */}
      {!loading && tanpaJabatan.length > 0 && (
        <div className="panel border-amber-200 bg-amber-50 p-4 mb-5">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {tanpaJabatan.length} staf belum punya jabatan — portalnya kosong
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Menu tugas dinyalakan oleh jabatan, jadi akun ini hanya melihat menu umum. Tetapkan lewat
                Akun Pengguna → tombol Jabatan.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tanpaJabatan.map(s => (
                  <Link key={s.id} href="/dashboard/admin/users"
                    className="status-badge border-amber-200 bg-white text-amber-800 hover:bg-amber-100">
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)}
            placeholder="Cari jabatan atau nama pemegang..." className="input-field pl-10" />
        </div>
        <div className="alat-aksi">
          <Link href="/dashboard/admin/users" className="btn-modal-cancel btn-teks">
            <UserCog size={15} /> Tetapkan Jabatan Staf
          </Link>
          <button onClick={openAdd} className="btn-modal-save">
            <Plus size={15} /> Tambah Jabatan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Award} title="Belum Ada Jabatan" description="Tambahkan jabatan seperti Kepala Sekolah, Wakil Kepala, Guru BK, dsb." />
      ) : (
        <>
          {ingatStruktur.length > 0 && (
        <div className="panel mb-5 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Pemegang jabatan sudah diperbarui, tetapi <b>Struktur Organisasi di situs publik</b> masih
            menulis {ingatStruktur.map(b => `${b.role}: ${b.name}`).join("; ")}. Daftar itu terpisah dan
            diketik manual — perbarui di{" "}
            <Link href="/dashboard/admin/content" className="font-semibold underline">Konten Halaman → Struktur Organisasi</Link>.
          </p>
        </div>
      )}

      {kosong > 0 && !q && (
            <p className="mb-2 text-sm text-gray-400">{kosong} jabatan belum ada pemegangnya.</p>
          )}
          <div className="panel overflow-hidden">
            <div className="divide-y divide-gray-50">
              {tersaring.map(item => (
                <div key={item.id} className="px-5 py-3.5 transition-colors hover:bg-primary-50/30">
                  <div className="flex items-center gap-3">
                    <Award size={16} className="shrink-0 text-gold" />
                    <p className="min-w-0 flex-1 font-semibold text-primary-900">{item.name}</p>
                    <span className="angka text-xs text-gray-400">
                      {item.pemegang.length === 0 ? "belum ada pemegang" : `${item.pemegang.length} orang`}
                    </span>
                    <button onClick={() => bukaPemegang(item)} className="rounded-lg p-1.5 text-primary-700 transition hover:bg-primary-50" title="Kelola pemegang">
                      <UserCog size={14} />
                    </button>
                    <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-primary-700 transition hover:bg-primary-50" title="Ubah nama jabatan">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(item)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50" title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Nama pemegangnya ditampilkan supaya pembagian tugas terlihat langsung — dulu
                      halaman ini hanya menghitung GURU, sehingga jabatan yang dipegang staf selalu
                      tertulis "0 guru" dan yang kurang satu orang tidak pernah ketahuan. */}
                  {item.pemegang.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                      {item.pemegang.map(p => (
                        <span key={`${p.jenis}-${p.id}`}
                          className={`status-badge ${p.jenis === "guru"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"}${p.nonaktif ? " opacity-50" : ""}`}
                          title={p.jenis === "guru" ? "Guru" : "Staf (role TAS)"}>
                          <Users size={11} /> {p.nama}{p.nonaktif ? " (nonaktif)" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {tersaring.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">Tidak ada jabatan yang cocok.</p>
              )}
            </div>
          </div>
        </>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah Jabatan" : "Tambah Jabatan"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <label className="label-field">Nama Jabatan</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Kepala Laboratorium" className="input-field" autoFocus />
      </Modal>

      <Modal scrollBody
        open={!!pemegangModal}
        onClose={() => setPemegangModal(null)}
        title="Kelola Pemegang Jabatan"
        description={pemegangModal?.name}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setPemegangModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={simpanPemegangJabatan} disabled={simpanPemegang || !kandidat} className="btn-modal-save flex-1">
              {simpanPemegang ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <p className="mb-3 text-sm text-gray-500">
          Centang siapa yang memegang jabatan ini. Menu di portal orang itu menyala/padam mengikuti
          centang ini, bukan mengikuti perannya.
        </p>
        {!kandidat ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
        ) : (
          <>
            <div className="alat-cari mb-3">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={cariOrang} onChange={e => setCariOrang(e.target.value)}
                placeholder="Cari nama..." className="input-field pl-10" />
            </div>
            {([["Guru", kandidat.guru, pilihGuru, setPilihGuru] as const,
               ["Staf & Admin", kandidat.staf, pilihStaf, setPilihStaf] as const]).map(([judul, daftar, dipilih, setPilih]) => {
              const tersaringOrang = daftar.filter(o => !cariOrang || o.nama.toLowerCase().includes(cariOrang.toLowerCase()));
              return (
                <div key={judul} className="mb-4">
                  <p className="label-kecil mb-2">{judul} <span className="text-gray-400">({dipilih.length} dipilih)</span></p>
                  {tersaringOrang.length === 0 ? (
                    <p className="text-sm text-gray-400">Tidak ada yang cocok.</p>
                  ) : (
                    <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-gray-100 p-3 sm:grid-cols-2">
                      {tersaringOrang.map(o => (
                        <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                          <input type="checkbox" checked={dipilih.includes(o.id)}
                            onChange={() => setPilih(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])} />
                          <span className={o.nonaktif ? "opacity-50" : ""}>{o.nama}{o.nonaktif ? " (nonaktif)" : ""}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </Modal>
    </div>
  );
}
