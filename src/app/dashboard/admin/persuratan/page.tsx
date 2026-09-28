"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Save, Trash2, Mail, Send, Eye, Search, PenLine, Printer, FileText, ClipboardSignature } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface BarisAgenda {
  id: string; sumber: "SURAT" | "KETERANGAN" | "TUGAS"; sumberLabel: string;
  nomor: string; urut: number; tanggal: string; pihak: string; perihal: string;
  hrefCetak: string; hrefEdit: string | null;
}

const GAYA_SUMBER: Record<string, string> = {
  SURAT: "bg-primary-50 text-primary-700 border-primary-100",
  KETERANGAN: "bg-blue-50 text-blue-700 border-blue-200",
  TUGAS: "bg-amber-50 text-amber-700 border-amber-200",
};

interface Surat {
  id: string; tipe: string; nomor: string;
  tanggal: string; pihak: string; perihal: string;
  keterangan?: string; fileUrl?: string; isRead: boolean;
  content?: string | null;
  docxUrl?: string | null;
  createdAt: string;
}

const EMPTY: Omit<Surat, "id" | "isRead" | "createdAt"> = {
  tipe: "MASUK", nomor: "", tanggal: "", pihak: "", perihal: "", keterangan: "", fileUrl: "",
};

function formatTgl(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PersuratanPage() {
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState<"MASUK" | "KELUAR">("MASUK");
  const [data, setData] = useState<Surat[]>([]);
  const [agenda, setAgenda] = useState<BarisAgenda[]>([]);
  const [nomorKembar, setNomorKembar] = useState<string[]>([]);
  const [sumberFilter, setSumberFilter] = useState("");
  const [pilihJenis, setPilihJenis] = useState(false);
  const [unreadMasuk, setUnreadMasuk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Partial<Surat> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/surat?tipe=${tab}`);
    const d = await res.json();
    setData(Array.isArray(d) ? d : []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** Buku agenda surat keluar gabungan — Persuratan + Surat Keterangan + Surat Tugas. */
  const fetchAgenda = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/surat/agenda");
      const d = await res.json();
      setAgenda(Array.isArray(d.baris) ? d.baris : []);
      setNomorKembar(Array.isArray(d.nomorKembar) ? d.nomorKembar : []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { fetchAgenda(); }, [fetchAgenda]);

  // Dihitung terpisah dari `data` (yang berubah-ubah ikut tab aktif) supaya badge "belum dibaca"
  // di tab Surat Masuk selalu akurat, tidak ikut kepakai angka Surat Keluar saat tab KELUAR aktif.
  const fetchUnreadMasuk = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/surat?tipe=MASUK");
      const d = await res.json();
      if (Array.isArray(d)) setUnreadMasuk(d.filter((s: Surat) => !s.isRead).length);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { fetchUnreadMasuk(); }, [fetchUnreadMasuk]);

  /** Agenda setelah disaring sumber & kotak cari — memakai kotak cari yang SAMA dengan tab
   * Surat Masuk supaya tidak ada dua kotak cari yang berperilaku beda. */
  const agendaTampil = agenda.filter(a => {
    if (sumberFilter && a.sumber !== sumberFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.nomor.toLowerCase().includes(q) || a.pihak.toLowerCase().includes(q) ||
      a.perihal.toLowerCase().includes(q) || a.sumberLabel.toLowerCase().includes(q);
  });

  const filtered = search
    ? data.filter(s =>
        s.nomor.toLowerCase().includes(search.toLowerCase()) ||
        s.pihak.toLowerCase().includes(search.toLowerCase()) ||
        s.perihal.toLowerCase().includes(search.toLowerCase())
      )
    : data;
  const halAgenda = usePaginasi(agendaTampil, 50, `${search}|${sumberFilter}|${tab}`);
  const halMasuk = usePaginasi(filtered, 50, `${search}|${tab}`);

  function openNew() {
    setIsNew(true);
    setModal({ ...EMPTY, tipe: tab });
    setErr("");
  }
  function openEdit(s: Surat) {
    setIsNew(false);
    setModal({ ...s, tanggal: s.tanggal.slice(0, 10) });
    setErr("");
  }

  async function handleSave() {
    if (!modal?.nomor || !modal.tanggal || !modal.pihak || !modal.perihal) {
      setErr("Nomor, tanggal, " + (tab === "MASUK" ? "dari" : "kepada") + ", dan perihal wajib diisi");
      return;
    }
    setSaving(true);
    const url  = isNew ? "/api/admin/surat" : `/api/admin/surat/${modal.id}`;
    const meth = isNew ? "POST" : "PUT";
    const res  = await fetch(url, {
      method: meth, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...modal, tipe: tab }),
    });
    setSaving(false);
    if (!res.ok) { setErr("Gagal menyimpan"); return; }
    setModal(null); fetchData(); fetchUnreadMasuk();
  }

  /** Hapus dari buku agenda, apa pun sumbernya. Tiap modul punya endpoint hapusnya sendiri —
   * dulu tombol hapus di agenda hanya muncul untuk baris Persuratan, sehingga Surat Keterangan
   * & Surat Tugas tidak bisa dihapus dari sini sama sekali (temuan user 13 September 2026). */
  const ENDPOINT_HAPUS: Record<string, string> = {
    SURAT: "/api/admin/surat",
    KETERANGAN: "/api/admin/surat-keterangan",
    TUGAS: "/api/admin/surat-tugas",
  };

  async function hapusAgenda(a: BarisAgenda) {
    const label = a.nomor || a.perihal || "surat ini";
    if (!await confirmDialog(`Hapus ${a.sumberLabel} ${label}? Nomor suratnya ikut terbebas.`)) return;
    const res = await fetch(`${ENDPOINT_HAPUS[a.sumber]}/${a.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setErr(`Gagal menghapus ${a.sumberLabel}.`); return; }
    setErr("");
    fetchData(); fetchUnreadMasuk(); fetchAgenda();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus surat ini?")) return;
    const res = await fetch(`/api/admin/surat/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setErr("Gagal menghapus surat."); return; }
    setErr("");
    // fetchAgenda() WAJIB ikut dipanggil: tab Surat Keluar sekarang dirender dari `agenda`
    // (gabungan tiga sumber), bukan dari `data`. Tanpa ini barisnya tetap terlihat di layar
    // padahal datanya sudah terhapus — terlihat seperti tombol hapusnya tidak berfungsi
    // (temuan user 13 September 2026).
    fetchData(); fetchUnreadMasuk(); fetchAgenda();
  }

  async function markRead(id: string) {
    await fetch(`/api/admin/surat/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    fetchData();
    fetchUnreadMasuk();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Mail size={22} />}
        title="Agenda Surat"
        description="Buku agenda surat masuk & keluar — surat biasa, Surat Keterangan, dan Surat Tugas tercatat dalam satu urutan nomor"
      />

      <div className="baris-alat mb-5">
        <div className="alat-tab flex gap-1 border border-gray-100 bg-white rounded-xl p-1">
          {(["MASUK", "KELUAR"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-primary-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "MASUK" ? <Mail size={15} /> : <Send size={15} />}
              Surat {t === "MASUK" ? "Masuk" : "Keluar"}
              {t === "MASUK" && unreadMasuk > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unreadMasuk}</span>
              )}
            </button>
          ))}
        </div>
        <div className="alat-aksi">
          {tab === "KELUAR" ? (
            <>
              <button onClick={() => setPilihJenis(true)} className="btn-modal-save btn-teks shrink-0">
                <PenLine size={15} /> Tulis Surat Keluar
              </button>
              <button onClick={openNew}
                className="btn-modal-cancel btn-teks shrink-0"
                title="Catat surat yang sudah ada di luar sistem, tanpa menulis isinya">
                <Plus size={15} /> Catat Manual
              </button>
            </>
          ) : (
            <button onClick={openNew} className="btn-modal-save btn-teks shrink-0">
              <Plus size={15} /> Catat Surat Masuk
            </button>
          )}
        </div>
      </div>


      {/* Toolbar */}
      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-10"
            placeholder="Cari nomor, pihak, perihal..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Tabel */}
      {tab === "KELUAR" ? (
        // Buku agenda surat keluar GABUNGAN — Persuratan + Surat Keterangan + Surat Tugas.
        // Formulir pembuatnya tetap di modul masing-masing (SPPD & tabel identitas berformat baku
        // tidak bisa dihasilkan dari editor bebas), tapi bukunya satu supaya nomor tidak bolong.
        <>
          {nomorKembar.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4">
              <p className="text-sm font-semibold text-red-700">
                {nomorKembar.length} nomor surat dipakai lebih dari satu dokumen
              </p>
              <p className="text-xs text-red-600 mt-0.5">{nomorKembar.join(", ")}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {[{ v: "", l: `Semua (${agenda.length})`, n: 1 },
              { v: "SURAT", l: `Surat Keluar (${agenda.filter(a => a.sumber === "SURAT").length})`, n: 1 },
              // Saringan "Surat Keterangan (lama)" cuma muncul kalau memang masih ada sisanya —
              // modulnya sudah dilebur ke Surat Keluar, jadi tombol kosong cuma bikin bingung.
              { v: "KETERANGAN", l: `Surat Keterangan lama (${agenda.filter(a => a.sumber === "KETERANGAN").length})`,
                n: agenda.filter(a => a.sumber === "KETERANGAN").length },
              { v: "TUGAS", l: `Surat Tugas & SPPD (${agenda.filter(a => a.sumber === "TUGAS").length})`, n: 1 }]
              .filter(f => f.n > 0).map(f => (
              <button key={f.v} onClick={() => setSumberFilter(f.v)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl border transition ${
                  sumberFilter === f.v ? "bg-primary-900 text-white border-primary-900"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                {f.l}
              </button>
            ))}
          </div>

          {agendaTampil.length === 0 ? (
            <EmptyState icon={Send} title="Belum ada surat keluar"
              description="Surat dari Persuratan, Surat Keterangan, dan Surat Tugas semuanya tercatat di sini." />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {["No. Surat", "Tanggal", "Jenis", "Kepada / Perihal", "Aksi"].map(h => (
                        <th key={h} className={`${h === "Aksi" ? "text-center" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {halAgenda.potongan.map(a => (
                      <tr key={`${a.sumber}-${a.id}`}
                        className={`${nomorKembar.includes(a.nomor) ? "bg-red-50/40" : ""}`}>
                        <td className="font-mono text-xs font-semibold text-primary-700 whitespace-nowrap">
                          {a.nomor || <span className="text-gray-300">(belum bernomor)</span>}
                        </td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{formatTgl(a.tanggal)}</td>
                        <td>
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${GAYA_SUMBER[a.sumber]}`}>
                            {a.sumberLabel}
                          </span>
                        </td>
                        <td className="max-w-md">
                          <span className="font-semibold text-primary-900 block truncate">{a.pihak}</span>
                          <span className="text-gray-500 text-xs block truncate">{a.perihal}</span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {a.hrefEdit && (
                              <Link href={a.hrefEdit} title="Buka / ubah surat ini"
                                className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                                <PenLine size={14} />
                              </Link>
                            )}
                            <Link href={a.hrefCetak} title="Cetak"
                              className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                              <Printer size={14} />
                            </Link>
                            <button onClick={() => hapusAgenda(a)} title={`Hapus ${a.sumberLabel}`}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={halAgenda} satuan="surat keluar" className="border-t border-gray-100" />
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                {agendaTampil.length} surat keluar · nomor tertinggi {agenda[0]?.nomor || "—"}
              </div>
            </div>
          )}
        </>
      ) : loading ? (
        <div className="flex justify-center py-16 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Mail} title="Belum ada surat masuk"
          description="Catat surat yang diterima sekolah di sini, lalu teruskan lewat menu Disposisi." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["No. Surat", "Tanggal", tab === "MASUK" ? "Dari" : "Kepada", "Perihal", "Status", "Aksi"].map(h => (
                    <th key={h} className={`${h === "Aksi" ? "text-center" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {halMasuk.potongan.map((s) => (
                  <tr key={s.id} className={`${!s.isRead && tab === "MASUK" ? "!bg-blue-50/50" : ""}`}>
                    <td className="font-mono text-xs font-semibold text-primary-700">{s.nomor}</td>
                    <td className="text-gray-500 text-xs">{formatTgl(s.tanggal)}</td>
                    <td className="font-semibold text-primary-900">{s.pihak}</td>
                    <td className="text-gray-500 max-w-xs truncate">{s.perihal}</td>
                    <td>
                      {tab === "MASUK" ? (
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.isRead ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {s.isRead ? "Dibaca" : "Belum Dibaca"}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">Terkirim</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {tab === "MASUK" && !s.isRead && (
                          <button onClick={() => markRead(s.id)} title="Tandai Sudah Dibaca"
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye size={14} />
                          </button>
                        )}
                        <button onClick={() => openEdit(s)}
                          className="px-2.5 py-1 text-xs font-semibold bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginasi hal={halMasuk} satuan="surat" className="border-t border-gray-100" />
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} surat {tab === "MASUK" ? "masuk" : "keluar"}
          </div>
        </div>
      )}

      {/* Pemilih jenis surat — SATU pintu untuk semua surat keluar.
          Surat Keterangan & Surat Tugas tidak lagi jadi menu terpisah di sidebar: keduanya
          tetap punya formulir sendiri (identitas siswa terisi otomatis dari Buku Induk; SPPD
          & Laporan berformat baku tiga lembar) tapi masuknya dari sini. */}
      <Modal open={pilihJenis} onClose={() => setPilihJenis(false)} size="lg"
        title="Tulis Surat Keluar" description="Semuanya masuk ke satu buku agenda dan satu urutan nomor">
        <div className="grid gap-3">
          {[
            { href: "/dashboard/admin/persuratan/new/edit", icon: FileText, judul: "Semua Jenis Surat",
              ket: "50 template siap pakai: undangan, permohonan, keterangan, panggilan, pemberitahuan, pernyataan, rekomendasi, edaran, mutasi, dan SK. Formulir isiannya muncul sesuai jenis suratnya — identitas siswa atau pegawai terisi otomatis." },
            { href: "/dashboard/admin/surat-tugas", icon: ClipboardSignature, judul: "Surat Tugas & SPPD",
              ket: "Satu-satunya yang punya formulir sendiri — karena satu pengisian menghasilkan tiga lembar terkait: Surat Tugas, SPPD butir 1-9, dan Laporan Perjalanan Dinas." },
          ].map(x => (
            <Link key={x.href} href={x.href} onClick={() => setPilihJenis(false)}
              className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/40 transition text-left">
              <span className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                <x.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-heading font-semibold text-primary-900">{x.judul}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{x.ket}</span>
              </span>
            </Link>
          ))}
        </div>
      </Modal>

      {/* Modal */}
      <Modal scrollBody
        open={modal !== null}
        onClose={() => setModal(null)}
        title={isNew ? `Tambah Surat ${tab === "MASUK" ? "Masuk" : "Keluar"}` : "Edit Surat"}
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              <Save size={15} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {err && <p className="error-msg">{err}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-field">Nomor Surat <span className="text-red-500">*</span></label>
              <input className="input-field" value={modal?.nomor ?? ""}
                onChange={e => setModal(p => ({ ...p, nomor: e.target.value }))}
                placeholder="Contoh: 001/SMK/VI/2025" />
            </div>
            <div>
              <label className="label-field">Tanggal <span className="text-red-500">*</span></label>
              <DatePicker value={modal?.tanggal ?? ""} onChange={v => setModal(p => ({ ...p, tanggal: v }))} />
            </div>
            <div>
              <label className="label-field">
                {tab === "MASUK" ? "Dari" : "Kepada"} <span className="text-red-500">*</span>
              </label>
              <input className="input-field" value={modal?.pihak ?? ""}
                onChange={e => setModal(p => ({ ...p, pihak: e.target.value }))}
                placeholder={tab === "MASUK" ? "Nama pengirim/instansi" : "Nama penerima/instansi"} />
            </div>
            <div className="col-span-2">
              <label className="label-field">Perihal <span className="text-red-500">*</span></label>
              <input className="input-field" value={modal?.perihal ?? ""}
                onChange={e => setModal(p => ({ ...p, perihal: e.target.value }))}
                placeholder="Isi perihal surat" />
            </div>
            <div className="col-span-2">
              <label className="label-field">Keterangan</label>
              <textarea className="input-field resize-none" rows={3} value={modal?.keterangan ?? ""}
                onChange={e => setModal(p => ({ ...p, keterangan: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label-field">Link File / Lampiran</label>
              <input className="input-field" value={modal?.fileUrl ?? ""}
                onChange={e => setModal(p => ({ ...p, fileUrl: e.target.value }))}
                placeholder="URL file (opsional)" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
