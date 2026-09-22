"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, BookOpen, Eye, UserCog, GraduationCap, Users, Award, Save } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import Modal from "@/components/admin/Modal";

interface Teacher {
  id: string;
  nip: string;
  subject: string;
  phone: string | null;
  shortCode: string | null;
  user: { id: string; name: string; email: string };
  homeroomOf: { id: string; name: string }[];
  jabatan: { jabatan: { id: string; name: string } }[];
}

interface JabatanOption { id: string; name: string }

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [jabatanOptions, setJabatanOptions] = useState<JabatanOption[]>([]);
  const [jabatanModal, setJabatanModal] = useState<Teacher | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/teachers");
    if (res.ok) setTeachers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/admin/jabatan").then(r => r.json()).then(d => { if (Array.isArray(d)) setJabatanOptions(d); }).catch(() => {});
  }, []);

  function openJabatan(t: Teacher) {
    setJabatanModal(t);
    setSelectedIds(t.jabatan.map(j => j.jabatan.id));
  }

  function toggleJabatan(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function saveJabatan() {
    if (!jabatanModal) return;
    setSaving(true);
    await fetch(`/api/admin/teachers/${jabatanModal.id}/jabatan`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jabatanIds: selectedIds }),
    });
    setSaving(false);
    setJabatanModal(null);
    load();
  }

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    return !q || t.user.name.toLowerCase().includes(q) || t.nip.includes(q) || t.subject.toLowerCase().includes(q);
  });
  const waliKelas = filtered.filter(t => t.homeroomOf.length > 0);
  const bukanWali = filtered.filter(t => t.homeroomOf.length === 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCog size={22} />}
        title="Kelola Guru"
        description="Atur NIP, mata pelajaran, dan data profil guru"
      />

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, NIP, atau mata pelajaran..."
          className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Tidak ada guru ditemukan" description="Tambah akun guru melalui menu Akun Pengguna." />
      ) : (
        <div className="space-y-6">
          {waliKelas.length > 0 && (
            <GroupedSection title="Wali Kelas" count={waliKelas.length} icon={GraduationCap}>
              <TeacherTable items={waliKelas} onManageJabatan={openJabatan} />
            </GroupedSection>
          )}
          {bukanWali.length > 0 && (
            <GroupedSection title="Bukan Wali Kelas" count={bukanWali.length} icon={Users}>
              <TeacherTable items={bukanWali} onManageJabatan={openJabatan} />
            </GroupedSection>
          )}
          <p className="text-xs text-gray-400">{filtered.length} guru terdaftar</p>
        </div>
      )}

      <Modal
        open={!!jabatanModal}
        onClose={() => setJabatanModal(null)}
        title="Kelola Jabatan"
        description={jabatanModal?.user.name}
        footer={
          <>
            <button type="button" onClick={() => setJabatanModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={saveJabatan} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {jabatanOptions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Belum ada katalog jabatan. Tambahkan lewat menu Jabatan.</p>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {jabatanOptions.map(j => (
              <label key={j.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selectedIds.includes(j.id)} onChange={() => toggleJabatan(j.id)}
                  className="w-4 h-4 rounded accent-primary-700" />
                <span className="text-sm text-gray-700">{j.name}</span>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function TeacherTable({ items, onManageJabatan }: { items: Teacher[]; onManageJabatan: (t: Teacher) => void }) {
  return (
    <div className="overflow-x-auto scrollbar-visible">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nama Guru</th>
            <th className="text-center">Kode</th>
            <th className="hidden sm:table-cell">NIP</th>
            <th>Mata Pelajaran</th>
            <th className="hidden md:table-cell">Jabatan</th>
            <th className="hidden lg:table-cell">HP</th>
            <th className="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id}>
              <td>
                <p className="font-semibold text-primary-900">{t.user.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{t.user.email}</p>
              </td>
              <td className="text-center">
                {t.shortCode
                  ? <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full font-mono">{t.shortCode}</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="font-mono text-xs text-gray-500 hidden sm:table-cell">{t.nip}</td>
              <td>
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <BookOpen size={13} className="text-primary-500 shrink-0" />
                  {t.subject}
                </span>
              </td>
              <td className="hidden md:table-cell">
                {t.jabatan.length === 0 ? (
                  <span className="text-gray-300 text-xs">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {t.jabatan.map(j => (
                      <span key={j.jabatan.id} className="text-xs font-semibold text-gold bg-primary-900 px-2 py-0.5 rounded-full">
                        {j.jabatan.name}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="text-xs text-gray-500 hidden lg:table-cell">
                {t.phone ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onManageJabatan(t)}
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition" title="Kelola Jabatan">
                    <Award size={14} />
                  </button>
                  <Link href={`/dashboard/admin/teachers/${t.id}`}
                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Lihat detail">
                    <Eye size={14} />
                  </Link>
                  <Link href={`/dashboard/admin/buku-induk/guru?edit=${t.id}`}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition" title="Edit Biodata di Buku Induk">
                    <BookOpen size={15} />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
