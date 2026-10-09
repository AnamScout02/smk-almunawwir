"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Loader2, Building2, ChevronRight, Star, TriangleAlert, Printer, FileCheck2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

interface InternshipItem {
  id: string;
  studentId: string;
  company: string;
  position: string;
  status: string;
  journal: { id: string }[];
  student: {
    nis: string;
    user: { name: string };
    class: { name: string } | null;
    major: { name: string } | null;
  };
}

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  ONGOING: { label: "Sedang PKL", badge: "bg-blue-50 text-blue-700 border border-blue-200" },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  CANCELLED: { label: "Dibatalkan", badge: "bg-red-50 text-red-600 border border-red-200" },
};

export default function TeacherPklPage() {
  const [items, setItems] = useState<InternshipItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/pkl").then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Briefcase size={22} />}
        title="PKL Pembimbingan"
        description="Pantau jurnal harian & beri catatan + nilai untuk siswa bimbingan PKL Anda"
      />

      <div className="alat-aksi alat-teks justify-end mb-5">
        <Link href="/dashboard/teacher/pkl/laporan-akhir" className="btn-modal-cancel"><FileCheck2 size={16} /> Laporan Akhir</Link>
        <Link href="/dashboard/teacher/pkl/laporan-monitoring" className="btn-modal-cancel"><Printer size={16} /> Laporan Monitoring</Link>
        <Link href="/dashboard/teacher/pkl/masalah" className="btn-modal-cancel"><TriangleAlert size={16} /> Laporan Masalah</Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Briefcase} title="Belum Ada Siswa Bimbingan" description="Anda belum ditugaskan sebagai guru pembimbing PKL untuk siswa manapun." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <Link key={item.id} href={`/dashboard/teacher/pkl/${item.studentId}`}
              className="panel group p-5 hover:border-primary-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-primary-900 truncate">{item.student.user.name}</p>
                  <p className="text-gray-400 text-xs">{item.student.class?.name ?? "—"} · {item.student.major?.name ?? "—"}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Building2 size={13} className="text-gray-400 shrink-0" />
                <span className="truncate">{item.company} — {item.position}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABEL[item.status]?.badge ?? ""}`}>
                  {STATUS_LABEL[item.status]?.label ?? item.status}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Star size={12} /> {item.journal.length} entri jurnal
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
