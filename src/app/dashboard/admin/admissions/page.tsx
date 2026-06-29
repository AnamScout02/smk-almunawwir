"use client";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, Clock, Trash2, Loader2, Search,
  ChevronDown, ChevronUp, CalendarCheck, FileText, ExternalLink, Download,
} from "lucide-react";

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
  ijazahUrl?: string;
  kkUrl?: string;
  ktpWaliUrl?: string;
  fotoUrl?: string;
  dokumenLainUrl?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PENDING:     { label: "Menunggu",   badge: "bg-yellow-100 text-yellow-700" },
  WAWANCARA:   { label: "Wawancara",  badge: "bg-blue-100 text-blue-700" },
  ACCEPTED:    { label: "Diterima",   badge: "bg-green-100 text-green-700" },
  REJECTED:    { label: "Ditolak",    badge: "bg-red-100 text-red-700" },
};

const FILTER_KEYS = ["SEMUA", "PENDING", "WAWANCARA", "ACCEPTED", "REJECTED"] as const;

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
  const [items, setItems] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("SEMUA");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

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
    if (!confirm("Hapus data pendaftaran ini? Tindakan ini tidak bisa dibatalkan.")) return;
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary-900">Kelola Pendaftaran</h1>
          <p className="text-gray-500 text-sm mt-1">Daftar calon siswa yang mendaftar melalui website</p>
        </div>
        <a href="/api/admin/export/admissions"
          className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Download size={15} />
          Export CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {FILTER_KEYS.map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-xl p-3 text-center border transition-all ${
              filter === k ? "bg-primary-700 text-white border-primary-700 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-primary-300"
            }`}>
            <div className="text-xl font-bold font-heading">{counts[k]}</div>
            <div className="text-xs mt-0.5 opacity-80">{filterLabels[k]}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, email, nomor WA, atau jurusan..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 outline-none" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-primary-500" size={32} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border">
              {search ? "Tidak ada hasil pencarian" : "Tidak ada data pendaftaran"}
            </div>
          ) : filtered.map(item => {
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
            const isExpanded = expanded === item.id;
            return (
              <div key={item.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-primary-900">{item.fullName}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
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
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-medium disabled:opacity-60">
                        <CalendarCheck size={12} /> Wawancara
                      </button>
                    )}
                    {item.status !== "ACCEPTED" && (
                      <button onClick={() => updateStatus(item.id, "ACCEPTED")}
                        disabled={updating === item.id + "ACCEPTED"}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-xs font-medium disabled:opacity-60">
                        <CheckCircle size={12} /> Terima
                      </button>
                    )}
                    {item.status !== "REJECTED" && (
                      <button onClick={() => updateStatus(item.id, "REJECTED")}
                        disabled={updating === item.id + "REJECTED"}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-medium disabled:opacity-60">
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
                  <div className="px-4 pb-5 border-t pt-4 bg-gray-50 space-y-4">
                    {/* Data pribadi */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Data Pribadi</p>
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

                    {/* Dokumen */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dokumen Pendukung</p>
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
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Catatan Admin <span className="font-normal normal-case">(ditampilkan ke pendaftar di Cek Status)</span>
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={notes[item.id] ?? item.notes ?? ""}
                          onChange={e => setNotes(n => ({ ...n, [item.id]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none bg-white"
                          placeholder="Contoh: Harap hadir wawancara Senin 14 Juli jam 09.00 WIB"
                        />
                        <button
                          onClick={() => saveNotes(item.id)}
                          disabled={updating === item.id + "notes"}
                          className="px-4 py-2 bg-primary-700 text-white rounded-lg text-xs font-semibold hover:bg-primary-800 disabled:opacity-60 flex items-center gap-1.5">
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
