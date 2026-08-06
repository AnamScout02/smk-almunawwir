"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Printer, Users, School, Image as ImageIcon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

interface ClassItem {
  id: string; name: string; grade: number;
  major: { name: string; code: string };
  homeroom: { user: { name: string } } | null;
  students: { id: string }[];
}

export default function AbsensiJurnalPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/classes").then(r => r.json()).then(d => { setClasses(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const grouped = [10, 11, 12]
    .map(grade => ({ grade, items: classes.filter(c => c.grade === grade).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="Absensi & Jurnal Kelas"
        description="Cetak lembar Absensi Siswa, Jurnal Mengajar, dan Rekap Absensi Bulanan per kelas"
        actions={
          <Link href="/dashboard/admin/absensi-jurnal/cover-editor" className="btn-gold flex items-center gap-2 text-sm">
            <ImageIcon size={16} /> Desain Cover
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : classes.length === 0 ? (
        <EmptyState icon={School} title="Belum Ada Kelas" description="Tambahkan kelas terlebih dahulu di menu Kelas." />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ grade, items }) => (
            <GroupedSection key={grade} title={`Kelas ${grade}`} count={items.length} icon={School}>
              <div className="divide-y divide-gray-50">
                {items.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-primary-50/30 transition-colors">
                    <div>
                      <p className="font-semibold text-navy">{cls.name}</p>
                      <p className="text-xs text-gray-400">{cls.major.name} · Wali: {cls.homeroom?.user.name ?? "Belum ditentukan"}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                        <Users size={12} /> {cls.students.length}
                      </span>
                      <Link href={`/dashboard/admin/absensi-jurnal/cetak-kelas/${cls.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold transition-colors">
                        <Printer size={13} /> Cetak
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </GroupedSection>
          ))}
        </div>
      )}
    </div>
  );
}
