import { Inbox, Megaphone } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import TombolDibaca from "@/components/shared/TombolDibaca";
import { TautanIkon } from "@/components/shared/IkonNama";
import { hakPengumuman, pengumumanUntuk } from "@/lib/pengumuman";

/** KOTAK PENGUMUMAN (server) — daftar pengumuman aktif untuk pengguna ini, semua portal. */
export default async function PengumumanMasuk({ session, kelolaHref, keterangan }: {
  session: { userId: string; email: string; role: string }; kelolaHref?: string; keterangan?: string;
}) {
  const [daftar, hak] = await Promise.all([pengumumanUntuk(session).catch(() => []), kelolaHref ? hakPengumuman(session) : null]);
  const belum = daftar.filter(p => p.wajibKonfirmasi && !p.dibaca).length;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Megaphone size={22} />} title="Pengumuman"
        description={belum ? `${belum} pengumuman meminta konfirmasi sudah dibaca` : (keterangan ?? "Informasi dari sekolah yang ditujukan kepada Anda")} />
      {kelolaHref && hak?.boleh && (
        <div className="alat-aksi justify-end mb-5">
          <TautanIkon href={kelolaHref} ikon="pengumuman" className="btn-modal-save">Buat &amp; Kelola Pengumuman</TautanIkon>
        </div>
      )}
      {daftar.length === 0 ? (
        <EmptyState icon={Inbox} title="Belum ada pengumuman" description="Pengumuman dari sekolah akan tampil di sini." />
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {daftar.map(p => {
              const penting = p.priority === "URGENT";
              return (
                <li key={p.id} className={`px-5 py-4 ${p.wajibKonfirmasi && !p.dibaca ? "bg-amber-50/50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {penting && <span className="status-badge bg-red-50 text-red-600 border-red-200">Penting</span>}
                    <p className="font-semibold text-primary-900">{p.title}</p>
                    <span className="ml-auto text-xs text-gray-500">
                      {p.startDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
                      {p.pembuatNama ? ` · ${p.pembuatNama}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{p.content}</p>
                  {p.wajibKonfirmasi && <TombolDibaca id={p.id} dibaca={p.dibaca} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
