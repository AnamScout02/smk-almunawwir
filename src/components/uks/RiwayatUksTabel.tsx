import { Stethoscope } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";

type Kunjungan = {
  id: string; visitDate: Date; complaint: string; treatment: string | null; notes: string | null;
  student: { nis: string; user: { name: string }; class: { name: string } | null };
  usages: { quantity: number; medicine: { name: string; unit: string } }[];
};

/** Tabel riwayat kunjungan UKS (baca saja) — server component. */
export default function RiwayatUksTabel({ data, tampilSiswa = true }: { data: Kunjungan[]; tampilSiswa?: boolean }) {
  if (!data.length) return <EmptyState icon={Stethoscope} title="Tidak ada kunjungan UKS" description="Belum ada catatan kunjungan UKS dalam 6 bulan terakhir." />;
  return (
    <div className="panel overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Tanggal</th>{tampilSiswa && <th>Siswa</th>}<th>Keluhan</th><th>Penanganan</th><th className="hidden md:table-cell">Obat</th></tr></thead>
        <tbody>
          {data.map(v => (
            <tr key={v.id}>
              <td className="text-xs whitespace-nowrap">{v.visitDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</td>
              {tampilSiswa && <td className="min-w-[9rem]"><p className="font-semibold text-primary-900">{v.student.user.name}</p><p className="text-xs text-gray-500">{v.student.class?.name ?? "-"}</p></td>}
              <td className="min-w-[10rem] text-sm">{v.complaint}</td>
              <td className="min-w-[10rem] text-sm text-gray-700">{v.treatment ?? "—"}{v.notes && <span className="block text-xs text-gray-500">{v.notes}</span>}</td>
              <td className="hidden md:table-cell text-xs text-gray-600">{v.usages.length ? v.usages.map(u => `${u.medicine.name} ${u.quantity} ${u.medicine.unit}`).join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
