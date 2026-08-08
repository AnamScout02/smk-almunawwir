"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, User, Phone, Calendar, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

interface Partner {
  id: string; name: string; address: string | null; contactPerson: string | null; contactPhone: string | null;
  industryField: string | null; mouStartDate: string | null; mouEndDate: string | null; notes: string | null;
  status: "AKTIF" | "AKAN_KEDALUWARSA" | "KEDALUWARSA" | "BELUM_ADA_MOU";
  pklCount: number;
}

const STATUS_META: Record<Partner["status"], { label: string; badge: string }> = {
  AKTIF: { label: "Aktif", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  AKAN_KEDALUWARSA: { label: "Akan Kedaluwarsa", badge: "bg-amber-50 text-amber-700 border border-amber-200" },
  KEDALUWARSA: { label: "Kedaluwarsa", badge: "bg-red-50 text-red-600 border border-red-200" },
  BELUM_ADA_MOU: { label: "Belum Ada MoU", badge: "bg-gray-50 text-gray-500 border border-gray-200" },
};

const STATUS_ORDER: Partner["status"][] = ["KEDALUWARSA", "AKAN_KEDALUWARSA", "AKTIF", "BELUM_ADA_MOU"];
const STATUS_TITLE: Record<Partner["status"], string> = {
  KEDALUWARSA: "MoU Kedaluwarsa — Perlu Diperbarui",
  AKAN_KEDALUWARSA: "Akan Kedaluwarsa (30 Hari)",
  AKTIF: "MoU Aktif",
  BELUM_ADA_MOU: "Belum Ada MoU",
};

export default function KepsekMitraPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/kepala-sekolah/industry-partners").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setPartners(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Building2 size={22} />}
        title="Peta Kemitraan Industri"
        description="Daftar perusahaan mitra PKL & status MoU kerja sama sekolah"
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/teacher" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : error ? (
        <p className="text-center text-gray-400 py-20">{error}</p>
      ) : partners.length === 0 ? (
        <EmptyState icon={Building2} title="Belum Ada Mitra Industri" description="Data mitra PKL belum diinput oleh admin." />
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map(status => {
            const items = partners.filter(p => p.status === status);
            if (items.length === 0) return null;
            return (
              <GroupedSection key={status} title={STATUS_TITLE[status]} count={items.length} icon={Building2}
                variant={status === "KEDALUWARSA" ? "warning" : "default"}>
                <div className="divide-y divide-gray-50">
                  {items.map(p => (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-900 text-sm">{p.name}</p>
                        {p.industryField && <p className="text-gray-400 text-xs">{p.industryField}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 shrink-0">
                        {p.contactPerson && <span className="flex items-center gap-1"><User size={11} className="text-gray-400" /> {p.contactPerson}</span>}
                        {p.contactPhone && <span className="flex items-center gap-1"><Phone size={11} className="text-gray-400" /> {p.contactPhone}</span>}
                        {p.mouEndDate && <span className="flex items-center gap-1"><Calendar size={11} className="text-gray-400" /> s.d. {fmt(p.mouEndDate)}</span>}
                        <span className="flex items-center gap-1 text-primary-600 font-semibold"><Users size={11} /> {p.pklCount} siswa</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_META[status].badge}`}>{STATUS_META[status].label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GroupedSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
