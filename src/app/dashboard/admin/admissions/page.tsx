"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, Clock, Trash2, Loader2, Search,
  ChevronDown, ChevronUp, CalendarCheck, FileText, ExternalLink, Download, ClipboardList, Users,
  Calculator, ShieldCheck, ClipboardCheck,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface Admission {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  birthPlace?: string;
  gender?: string;
  nik?: string;
  nisn?: string;
  address?: string;
  guardianName?: string;
  previousSchool?: string;
  chosenMajor: string;
  jalur: string;
  ijazahUrl?: string;
  kkUrl?: string;
  ktpWaliUrl?: string;
  fotoUrl?: string;
  dokumenLainUrl?: string;
  status: string;
  notes?: string;
  nilaiRapor?: number | null;
  nilaiTes?: number | null;
  skorAkhir?: number | null;
  buktiPembayaranUrl?: string | null;
  daftarUlangConfirmedAt?: string | null;
  paymentVerified?: boolean;
  createdAt: string;
}

const JALUR_LABEL: Record<string, string> = {
  REGULER: "Reguler", PRESTASI_AKADEMIK: "Prestasi Akademik", PRESTASI_NON_AKADEMIK: "Prestasi Non-Akademik",
  TAHFIDZ: "Tahfidz Qur'an", AFIRMASI: "Afirmasi",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  PENDING:   { label: "Menunggu",  badge: "bg-amber-50 text-amber-700 border border-amber-200",    dot: "bg-amber-500" },
  WAWANCARA: { label: "Wawancara", badge: "bg-blue-50 text-blue-700 border border-blue-200",       dot: "bg-blue-500" },
  ACCEPTED:  { label: "Diterima",  badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  REJECTED:  { label: "Ditolak",   badge: "bg-red-50 text-red-600 border border-red-200",          dot: "bg-red-500" },
};

const FILTER_KEYS = ["SEMUA", "PENDING", "WAWANCARA", "ACCEPTED", "REJECTED"] as const;

const FILTER_TILE: Record<string, { icon: React.ElementType; grad: string; ring: string }> = {
  SEMUA:     { icon: Users,         grad: "from-primary-500 to-primary-700", ring: "ring-primary-100" },
  PENDING:   { icon: Clock,         grad: "from-amber-500 to-amber-600",     ring: "ring-amber-100" },
  WAWANCARA: { icon: CalendarCheck, grad: "from-blue-500 to-blue-600",       ring: "ring-blue-100" },
  ACCEPTED:  { icon: CheckCircle,   grad: "from-emerald-500 to-emerald-600", ring: "ring-emerald-100" },
  REJECTED:  { icon: XCircle,       grad: "from-red-500 to-red-600",         ring: "ring-red-100" },
};

function DocLink({ url, label }: { url?: string | null; label: string }) {
  if (!url) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 hover:underline">
      <FileText size={11} />
      {label}
      <ExternalLink size={10} />
    </a>
  );
}

export default function AdminAdmissionsPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("SEMUA");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState<Record<string, { nilaiRapor: string; nilaiTes: string }>>({});
  const [bobot, setBobot] = useState({ bobotRapor: 60, bobotTes: 40 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admissions");
      setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/spmb-settings").then(r => r.json()).then(setBobot).catch(() => {}); }, []);

  function scoreVal(id: string, key: "nilaiRapor" | "nilaiTes", fallback: number | null | undefined) {
    return scoreForm[id]?.[key] ?? (fallback != null ? String(fallback) : "");
  }
  function setScoreVal(id: string, key: "nilaiRapor" | "nilaiTes", value: string) {
    setScoreForm(p => ({ ...p, [id]: { nilaiRapor: p[id]?.nilaiRapor ?? "", nilaiTes: p[id]?.nilaiTes ?? "", [key]: value } }));
  }

  async function handleHitungSkor(item: Admission) {
    const nilaiRapor = Number(scoreVal(item.id, "nilaiRapor", item.nilaiRapor));
    const nilaiTes = Number(scoreVal(item.id, "nilaiTes", item.nilaiTes));
    const skorAkhir = Math.round((nilaiRapor * bobot.bobotRapor / 100 + nilaiTes * bobot.bobotTes / 100) * 100) / 100;
    setUpdating(item.id + "skor");
    await fetch(`/api/admin/admissions/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nilaiRapor, nilaiTes, skorAkhir }),
    });
    setUpdating(null);
    toast.success(`Skor dihitung: ${skorAkhir}`);
    load();
  }

  async function togglePaymentVerified(item: Admission) {
    setUpdating(item.id + "payment");
    await fetch(`/api/admin/admissions/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentVerified: !item.paymentVerified }),
    });
    setUpdating(null);
    load();
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id + status);
    await fetch(`/api/admin/admissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes: notes[id] ?? items.find(i => i.id === id)?.notes ?? "" }),
    });
    setUpdating(null);
    load();
  }

  async function saveNotes(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setUpdating(id + "notes");
    await fetch(`/api/admin/admissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status, notes: notes[id] ?? "" }),
    });
    setUpdating(null);
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Hapus data pendaftaran ini? Tindakan ini tidak bisa dibatalkan."))) return;
    await fetch(`/api/admin/admissions/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      i.fullName.toLowerCase().includes(q) ||
      i.chosenMajor.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      i.phone.includes(q);
    const matchFilter = filter === "SEMUA" || i.status === filter;
    return matchSearch && matchFilter;
  });

  const counts: Record<string, number> = {
    SEMUA: items.length,
    PENDING: items.filter(i => i.status === "PENDING").length,
    WAWANCARA: items.filter(i => i.status === "WAWANCARA").length,
    ACCEPTED: items.filter(i => i.status === "ACCEPTED").length,
    REJECTED: items.filter(i => i.status === "REJECTED").length,
  };

  const filterLabels: Record<string, string> = {
    SEMUA: "Total", PENDING: "Menunggu", WAWANCARA: "Wawancara", ACCEPTED: "Diterima", REJECTED: "Ditolak",
  };

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="Kelola Pendaftaran"
        description="Daftar calon siswa yang mendaftar melalui website"
        actions={
          <a href="/api/admin/export/admissions"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} />
            Export CSV
          </a>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {FILTER_KEYS.map(k => {
          const tile = FILTER_TILE[k];
          const active = filter === k;
          return (
            <button key={k} onClick={() => setFilter(k)}
              className={`group relative overflow-hidden rounded-xl p-3.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left bg-gradient-to-br ${tile.grad} ring-1 ${tile.ring} ${
                active ? "ring-2 ring-inset ring-white shadow-lg" : "opacity-75 hover:opacity-100"
              }`}>
              <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <tile.icon size={56} className="text-white" />
              </div>
              <div className="relative">
                <p className="font-heading font-bold text-xl leading-tight text-white">{counts[k]}</p>
                <p className="text-white/75 text-[10px] font-medium leading-tight truncate mt-0.5">{filterLabels[k]}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, email, nomor WA, atau jurusan..."
          className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-primary-500" size={32} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState icon={ClipboardList} description={search ? "Tidak ada hasil pencarian" : "Tidak ada data pendaftaran"} />
          ) : filtered.map(item => {
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
            const isExpanded = expanded === item.id;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-primary-900">{item.fullName}</h3>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {item.jalur && item.jalur !== "REGULER" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          {JALUR_LABEL[item.jalur] ?? item.jalur}
                        </span>
                      )}
                      {item.skorAkhir != null && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200">
                          <Calculator size={11} /> {item.skorAkhir}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{item.chosenMajor} · {item.email} · {item.phone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Mendaftar: {new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {item.status !== "WAWANCARA" && (
                      <button onClick={() => updateStatus(item.id, "WAWANCARA")}
                        disabled={updating === item.id + "WAWANCARA"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                        <CalendarCheck size={12} /> Wawancara
                      </button>
                    )}
                    {item.status !== "ACCEPTED" && (
                      <button onClick={() => updateStatus(item.id, "ACCEPTED")}
                        disabled={updating === item.id + "ACCEPTED"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                        <CheckCircle size={12} /> Terima
                      </button>
                    )}
                    {item.status !== "REJECTED" && (
                      <button onClick={() => updateStatus(item.id, "REJECTED")}
                        disabled={updating === item.id + "REJECTED"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                        <XCircle size={12} /> Tolak
                      </button>
                    )}
                    {item.status !== "PENDING" && (
                      <button onClick={() => updateStatus(item.id, "PENDING")}
                        disabled={updating === item.id + "PENDING"}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs font-medium disabled:opacity-60">
                        <Clock size={12} /> Reset
                      </button>
                    )}
                    <button onClick={() => setExpanded(isExpanded ? null : item.id)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button onClick={() => remove(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Detail expandable */}
                {isExpanded && (
                  <div className="px-4 pb-5 border-t border-primary-50 pt-4 space-y-4"
                    style={{ background: "linear-gradient(180deg, rgba(15,26,69,0.02) 0%, transparent 100%)" }}>
                    {/* Data pribadi */}
                    <div>
                      <p className="text-xs font-bold text-primary-600/60 uppercase tracking-widest mb-2">Data Pribadi</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div><span className="text-gray-400 text-xs block">Tempat, Tgl Lahir</span>
                          <p className="font-medium">{item.birthPlace || "—"}, {new Date(item.birthDate).toLocaleDateString("id-ID")}</p></div>
                        <div><span className="text-gray-400 text-xs block">Jenis Kelamin</span>
                          <p className="font-medium">{item.gender || "—"}</p></div>
                        <div><span className="text-gray-400 text-xs block">NIK</span>
                          <p className="font-medium font-mono">{item.nik || "—"}</p></div>
                        <div><span className="text-gray-400 text-xs block">NISN</span>
                          <p className="font-medium font-mono">{item.nisn || "—"}</p></div>
                        <div><span className="text-gray-400 text-xs block">Nama Wali</span>
                          <p className="font-medium">{item.guardianName || "—"}</p></div>
                        <div><span className="text-gray-400 text-xs block">Asal Sekolah</span>
                          <p className="font-medium">{item.previousSchool || "—"}</p></div>
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-gray-400 text-xs block">Alamat</span>
                          <p className="font-medium">{item.address || "—"}</p>
                        </div>
                        <div><span className="text-gray-400 text-xs block">Konsentrasi Keahlian</span>
                          <p className="font-medium">{item.chosenMajor || "—"}</p></div>
                      </div>
                    </div>

                    {/* Nilai & Skor Otomatis */}
                    <div>
                      <p className="text-xs font-bold text-primary-600/60 uppercase tracking-widest mb-2">
                        Nilai &amp; Skor <span className="font-normal normal-case text-gray-400">(bobot rapor {bobot.bobotRapor}% + tes {bobot.bobotTes}%)</span>
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="text-[11px] text-gray-400 block mb-1">Nilai Rapor</label>
                          <input type="number" value={scoreVal(item.id, "nilaiRapor", item.nilaiRapor)}
                            onChange={e => setScoreVal(item.id, "nilaiRapor", e.target.value)}
                            className="input-field w-24 text-center" placeholder="0-100" />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-400 block mb-1">Nilai Tes</label>
                          <input type="number" value={scoreVal(item.id, "nilaiTes", item.nilaiTes)}
                            onChange={e => setScoreVal(item.id, "nilaiTes", e.target.value)}
                            className="input-field w-24 text-center" placeholder="0-100" />
                        </div>
                        <button onClick={() => handleHitungSkor(item)} disabled={updating === item.id + "skor"}
                          className="flex items-center gap-1.5 px-3 py-2 bg-primary-700 text-white rounded-xl text-xs font-semibold hover:bg-primary-800 disabled:opacity-60">
                          {updating === item.id + "skor" ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />} Hitung Skor
                        </button>
                        {item.skorAkhir != null && (
                          <span className="text-sm font-bold text-primary-700 px-3 py-2">Skor Akhir: {item.skorAkhir}</span>
                        )}
                      </div>
                    </div>

                    {/* Daftar Ulang & Pembayaran — hanya untuk yang sudah DITERIMA */}
                    {item.status === "ACCEPTED" && (
                      <div>
                        <p className="text-xs font-bold text-primary-600/60 uppercase tracking-widest mb-2">Daftar Ulang &amp; Pembayaran</p>
                        {item.daftarUlangConfirmedAt ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ClipboardCheck size={12} /> Daftar ulang dikonfirmasi {new Date(item.daftarUlangConfirmedAt).toLocaleDateString("id-ID")}
                            </span>
                            {item.buktiPembayaranUrl && <DocLink url={item.buktiPembayaranUrl} label="Bukti Pembayaran" />}
                            <button onClick={() => togglePaymentVerified(item)} disabled={updating === item.id + "payment"}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${
                                item.paymentVerified ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              }`}>
                              <ShieldCheck size={12} /> {item.paymentVerified ? "Terverifikasi" : "Verifikasi Pembayaran"}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Belum konfirmasi daftar ulang. Arahkan pendaftar ke halaman <span className="font-mono">/daftar-ulang</span>.</p>
                        )}
                      </div>
                    )}

                    {/* Dokumen */}
                    <div>
                      <p className="text-xs font-bold text-primary-600/60 uppercase tracking-widest mb-2">Dokumen Pendukung</p>
                      <div className="flex flex-wrap gap-3">
                        <DocLink url={item.ijazahUrl} label="Ijazah / SKL" />
                        <DocLink url={item.kkUrl} label="Kartu Keluarga" />
                        <DocLink url={item.ktpWaliUrl} label="KTP Wali" />
                        <DocLink url={item.fotoUrl} label="Pas Foto" />
                        <DocLink url={item.dokumenLainUrl} label="Dokumen Lain" />
                      </div>
                    </div>

                    {/* Catatan admin */}
                    <div>
                      <p className="text-xs font-bold text-primary-600/60 uppercase tracking-widest mb-2">
                        Catatan Admin <span className="font-normal normal-case text-gray-400">(ditampilkan ke pendaftar di Cek Status)</span>
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={notes[item.id] ?? item.notes ?? ""}
                          onChange={e => setNotes(n => ({ ...n, [item.id]: e.target.value }))}
                          className="input-field flex-1 min-w-0"
                          placeholder="Contoh: Harap hadir wawancara Senin 14 Juli jam 09.00 WIB"
                        />
                        <button
                          onClick={() => saveNotes(item.id)}
                          disabled={updating === item.id + "notes"}
                          className="px-4 py-2 bg-primary-700 text-white rounded-xl text-xs font-semibold hover:bg-primary-800 disabled:opacity-60 flex items-center gap-1.5 transition-colors">
                          {updating === item.id + "notes" ? <Loader2 size={12} className="animate-spin" /> : null}
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
