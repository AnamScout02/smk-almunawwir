"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Save, Trash2, Mail, Send, Eye, Search, PenLine, Printer } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";

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

  const filtered = search
    ? data.filter(s =>
        s.nomor.toLowerCase().includes(search.toLowerCase()) ||
        s.pihak.toLowerCase().includes(search.toLowerCase()) ||
        s.perihal.toLowerCase().includes(search.toLowerCase())
      )
    : data;

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

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus surat ini?")) return;
    await fetch(`/api/admin/surat/${id}`, { method: "DELETE" });
    fetchData(); fetchUnreadMasuk();
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
        title="Persuratan"
        description="Manajemen surat masuk dan surat keluar sekolah"
        actions={
          <>
            {tab === "KELUAR" && (
              <Link href="/dashboard/admin/persuratan/new/setup"
                className="flex items-center gap-2 border border-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/10 transition shrink-0">
                <PenLine size={15} /> Tulis Surat Keluar
              </Link>
            )}
            <button onClick={openNew}
              className="btn-gold flex items-center gap-2 text-sm shrink-0">
              <Plus size={15} /> Tambah Surat {tab === "MASUK" ? "Masuk" : "Keluar"}
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(["MASUK", "KELUAR"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "MASUK" ? <Mail size={15} /> : <Send size={15} />}
            Surat {t === "MASUK" ? "Masuk" : "Keluar"}
            {t === "MASUK" && unreadMasuk > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unreadMasuk}</span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-10"
            placeholder="Cari nomor, pihak, perihal..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Mail} title={`Belum ada surat ${tab === "MASUK" ? "masuk" : "keluar"}`} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100"
                  style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  {["No. Surat", "Tanggal", tab === "MASUK" ? "Dari" : "Kepada", "Perihal", "Status", "Aksi"].map(h => (
                    <th key={h} className={`px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 ${h === "Aksi" ? "text-center" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={`border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors ${!s.isRead && tab === "MASUK" ? "!bg-blue-50/50" : ""}`}>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-primary-700">{s.nomor}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{formatTgl(s.tanggal)}</td>
                    <td className="px-5 py-3.5 font-semibold text-primary-900">{s.pihak}</td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{s.perihal}</td>
                    <td className="px-5 py-3.5">
                      {tab === "MASUK" ? (
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.isRead ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {s.isRead ? "Dibaca" : "Belum Dibaca"}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">Terkirim</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {tab === "MASUK" && !s.isRead && (
                          <button onClick={() => markRead(s.id)} title="Tandai Sudah Dibaca"
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye size={14} />
                          </button>
                        )}
                        {tab === "KELUAR" && (
                          <>
                            <Link
                              href={`/dashboard/admin/persuratan/${s.id}/${s.docxUrl && !s.content ? "edit-word" : "edit"}`}
                              title="Tulis/Edit Isi Surat"
                              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                              <PenLine size={14} />
                            </Link>
                            {(s.content || s.docxUrl) && (
                              <Link href={`/dashboard/admin/persuratan/${s.id}/cetak`} title="Cetak"
                                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                <Printer size={14} />
                              </Link>
                            )}
                          </>
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
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} surat {tab === "MASUK" ? "masuk" : "keluar"}
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={isNew ? `Tambah Surat ${tab === "MASUK" ? "Masuk" : "Keluar"}` : "Edit Surat"}
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
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
