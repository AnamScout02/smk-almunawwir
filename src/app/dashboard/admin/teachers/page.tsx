"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, BookOpen, Eye, UserCog, GraduationCap, Users } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";

interface Teacher {
  id: string;
  nip: string;
  subject: string;
  phone: string | null;
  shortCode: string | null;
  user: { id: string; name: string; email: string };
  homeroomOf: { id: string; name: string }[];
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/teachers");
    if (res.ok) setTeachers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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
              <TeacherTable items={waliKelas} />
            </GroupedSection>
          )}
          {bukanWali.length > 0 && (
            <GroupedSection title="Bukan Wali Kelas" count={bukanWali.length} icon={Users}>
              <TeacherTable items={bukanWali} />
            </GroupedSection>
          )}
          <p className="text-xs text-gray-400">{filtered.length} guru terdaftar</p>
        </div>
      )}
    </div>
  );
}

function TeacherTable({ items }: { items: Teacher[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Guru</th>
            <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kode</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden sm:table-cell">NIP</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mata Pelajaran</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden lg:table-cell">HP</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5">
                <p className="font-semibold text-primary-900">{t.user.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{t.user.email}</p>
              </td>
              <td className="px-5 py-3.5 text-center">
                {t.shortCode
                  ? <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full font-mono">{t.shortCode}</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-gray-500 hidden sm:table-cell">{t.nip}</td>
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <BookOpen size={13} className="text-primary-400 shrink-0" />
                  {t.subject}
                </span>
              </td>
              <td className="px-5 py-3.5 text-xs text-gray-500 hidden lg:table-cell">
                {t.phone ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1">
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
