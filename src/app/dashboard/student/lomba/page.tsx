export const dynamic = "force-dynamic";

import Image from "next/image";
import { Medal, ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import PageHeader from "@/components/admin/PageHeader";
import Panel from "@/components/shared/Panel";
import { LABEL_JENIS, LABEL_TINGKAT, STATUS_DAFTAR_INFO, tglEvent, pendaftaranTerbuka, rupiah } from "@/lib/event-label";

/** LOMBA & EVENT — portal siswa: event yang masih menerima pendaftaran (disaring jurusan) + pendaftaran
 *  siswa itu sendiri beserta status & catatan panitia. Mendaftarnya tetap di /lomba/<slug> supaya satu
 *  formulir untuk semua; event tanpa centang "tampil di website" pun bisa dibuka siswa di sana. */
export default async function Page() {
  const session = await verifyRole(["STUDENT"]);
  const siswa = await prisma.student.findUnique({ where: { userId: session.userId }, select: { id: true, majorId: true } }).catch(() => null);
  const [event, milik] = await Promise.all([
    prisma.event.findMany({
      where: { aktif: true },
      orderBy: [{ tutupDaftar: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: { id: true, slug: true, judul: true, penyelenggara: true, jenis: true, tingkat: true, berbayar: true, biaya: true,
        tutupDaftar: true, posterUrl: true, aktif: true, jurusanIds: true, tautanLuar: true },
    }).catch(() => []),
    siswa ? prisma.pendaftaranEvent.findMany({
      where: { studentId: siswa.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, juara: true, catatanPanitia: true, createdAt: true, event: { select: { slug: true, judul: true, penyelenggara: true } } },
    }).catch(() => []) : Promise.resolve([]),
  ]);
  const sudah = new Set(milik.map(m => m.event.slug));
  const kini = new Date();
  const buka = event.filter(e => pendaftaranTerbuka(e, kini) && !sudah.has(e.slug)
    && (!e.jurusanIds.length || (!!siswa?.majorId && e.jurusanIds.includes(siswa.majorId))));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Medal size={22} />} title="Lomba & Event" description="Lomba dan event yang bisa kamu ikuti, serta status pendaftaranmu" />

      <div className="space-y-6">
        <Panel judul="Pendaftaran Saya" ikon={<ListChecks size={16} />} isi={false}>
          {milik.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Kamu belum mendaftar lomba atau event apa pun.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {milik.map(m => {
                const st = STATUS_DAFTAR_INFO[m.status] ?? STATUS_DAFTAR_INFO.DIAJUKAN;
                return (
                  <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <a href={`/lomba/${m.event.slug}`} className="font-semibold text-primary-900 hover:underline">{m.event.judul}</a>
                      <p className="text-sm text-gray-500">{m.event.penyelenggara} · mendaftar {m.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</p>
                      {m.catatanPanitia && <p className="mt-1 text-sm text-gray-600">Catatan panitia: {m.catatanPanitia}</p>}
                    </div>
                    <span className={`status-badge ${st.gaya}`}>{st.label}{m.juara ? ` · ${m.juara}` : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div>
          <h2 className="label-kecil mb-3 text-gray-500">Pendaftaran dibuka</h2>
          {buka.length === 0 ? (
            <p className="panel py-10 text-center text-sm text-gray-400">Belum ada lomba atau event yang dibuka untukmu.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {buka.map(e => (
                <a key={e.id} href={`/lomba/${e.slug}#daftar`} className="panel panel-interaktif flex min-w-0 overflow-hidden">
                  <div className="relative w-24 shrink-0 bg-gradient-to-br from-primary-900 to-primary-700">
                    {e.posterUrl && <Image src={e.posterUrl} alt="" fill sizes="96px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold-dark">{LABEL_JENIS.id[e.jenis] ?? e.jenis} · {LABEL_TINGKAT.id[e.tingkat] ?? e.tingkat}</p>
                    <p className="mt-1 font-semibold text-primary-900">{e.judul}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {e.tutupDaftar ? `Sampai ${tglEvent(e.tutupDaftar, "id-ID", false)}` : e.penyelenggara}
                      {" · "}{e.berbayar && e.biaya ? rupiah(e.biaya) : "Gratis"}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
