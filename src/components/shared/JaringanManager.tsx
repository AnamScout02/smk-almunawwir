"use client";
import { useEffect, useRef, useState } from "react";
import {
  Network, Loader2, Plus, Trash2, Save, Router, Wifi, Users, Activity,
  RefreshCw, Search, Cpu, HardDrive, Thermometer, Gauge, Terminal, Trophy, Printer, Edit2,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface MikrotikRow { [key: string]: string }
interface StatusData { identity: MikrotikRow; resource: MikrotikRow; interfaces: MikrotikRow[]; health: MikrotikRow[] }
interface HotspotData { users: MikrotikRow[]; active: MikrotikRow[] }
interface PppoeData { secrets: MikrotikRow[]; active: MikrotikRow[] }
interface ChartPoint { t: string; rx: number; tx: number }

const TABS = ["Ringkasan", "Status Perangkat", "Bandwidth", "Perangkat Terhubung", "Hotspot", "PPPoE"] as const;
type Tab = typeof TABS[number];
const MAX_CHART_POINTS = 30;
const LOG_TOPIC_COLOR: Record<string, string> = {
  critical: "text-red-600 bg-red-50 border-red-100",
  error: "text-red-600 bg-red-50 border-red-100",
  warning: "text-amber-600 bg-amber-50 border-amber-100",
};
function logColor(topics: string) {
  for (const key of Object.keys(LOG_TOPIC_COLOR)) if (topics.includes(key)) return LOG_TOPIC_COLOR[key];
  return "text-gray-500 bg-gray-50 border-gray-100";
}

const EMPTY_USER_FORM = { name: "", password: "", profile: "", comment: "" };

function fmtBits(v: string | undefined) {
  const n = Number(v ?? 0);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + " Gbps";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + " Mbps";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + " Kbps";
  return n + " bps";
}
function fmtBytes(v: string | undefined) {
  const n = Number(v ?? 0);
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(2) + " GB";
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}
function displayComment(comment: string | undefined) {
  if (!comment) return "";
  return comment.startsWith("sid:") ? comment.split(" ").slice(1).join(" ") : comment;
}

export default function JaringanManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Ringkasan");
  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState("");

  const [status, setStatus] = useState<StatusData | null>(null);
  const [traffic, setTraffic] = useState<MikrotikRow[]>([]);
  const [leases, setLeases] = useState<MikrotikRow[]>([]);
  const [hotspot, setHotspot] = useState<HotspotData>({ users: [], active: [] });
  const [pppoe, setPppoe] = useState<PppoeData>({ secrets: [], active: [] });

  const [search, setSearch] = useState("");
  const [hotspotSearch, setHotspotSearch] = useState("");
  const [userModal, setUserModal] = useState<null | "HOTSPOT" | "PPPOE">(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [profiles, setProfiles] = useState<MikrotikRow[]>([]);
  const [ipPools, setIpPools] = useState<MikrotikRow[]>([]);
  const [ipBindings, setIpBindings] = useState<MikrotikRow[]>([]);
  const [bindingModal, setBindingModal] = useState(false);
  const [bindingForm, setBindingForm] = useState({ macAddress: "", address: "", type: "bypassed", comment: "" });
  const [profileModal, setProfileModal] = useState<null | "ADD" | "EDIT">(null);
  const [editingProfileName, setEditingProfileName] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", rateLimit: "", sharedUsers: "", addressPool: "", sessionTimeout: "", idleTimeout: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; disabled: number; profilesCreated: number; totalAktif: number; skipped: number; conflicts: string[] } | null>(null);

  const [logs, setLogs] = useState<MikrotikRow[]>([]);
  const [chartInterface, setChartInterface] = useState("");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const chartDataRef = useRef<ChartPoint[]>([]);
  const [chartTick, setChartTick] = useState(0);
  // "live" = polling tiap 4 detik seperti sebelumnya (data ephemeral, hilang saat tab ditutup).
  // Selain itu = ambil dari riwayat tersimpan (BandwidthLog, diisi sampler background) — mirip MRTG.
  const [chartRange, setChartRange] = useState<"live" | "1h" | "24h" | "7d" | "30d">("live");
  const [historyLoading, setHistoryLoading] = useState(false);

  const [printProfile, setPrintProfile] = useState("");

  function loadAll() {
    setLoading(true);
    setConnError("");
    Promise.all([
      fetch("/api/jaringan/status").then(r => r.json()).catch(() => {}),
      fetch("/api/jaringan/dhcp-leases").then(r => r.json()).catch(() => {}),
      fetch("/api/jaringan/hotspot-users").then(r => r.json()).catch(() => {}),
      fetch("/api/jaringan/pppoe-users").then(r => r.json()).catch(() => {}),
      fetch("/api/jaringan/hotspot-profiles").then(r => r.json()).catch(() => {}),
      fetch("/api/jaringan/ip-pools").then(r => r.json()).catch(() => {}),
      fetch("/api/jaringan/ip-bindings").then(r => r.json()).catch(() => {}),
    ]).then(([s, l, h, p, pr, pools, bindings]) => {
      if (s?.error) { setConnError(s.error); }
      else {
        setStatus(s);
        if (!chartInterface && Array.isArray(s.interfaces)) {
          const running = s.interfaces.filter((i: MikrotikRow) => i.disabled === "false");
          const busiest = [...running].sort((a, b) => Number(b["rx-byte"] ?? 0) - Number(a["rx-byte"] ?? 0))[0];
          if (busiest) setChartInterface(busiest.name);
        }
      }
      setLeases(Array.isArray(l) ? l : []);
      setHotspot(h?.users ? h : { users: [], active: [] });
      setPppoe(p?.secrets ? p : { secrets: [], active: [] });
      setProfiles(Array.isArray(pr) ? pr : []);
      setIpPools(Array.isArray(pools) ? pools : []);
      setIpBindings(Array.isArray(bindings) ? bindings : []);
      setLoading(false);
    }).catch(() => { setConnError("Tidak bisa terhubung ke server."); setLoading(false); });
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/jaringan/hotspot-users/sync", { method: "POST" });
    setSyncing(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal sinkronisasi"); return; }
    setSyncResult(await res.json());
    loadAll();
  }

  function openAddProfile() {
    setEditingProfileName(null);
    setProfileForm({ name: "", rateLimit: "", sharedUsers: "", addressPool: "", sessionTimeout: "", idleTimeout: "" });
    setError("");
    setProfileModal("ADD");
  }

  function openEditProfile(p: MikrotikRow) {
    setEditingProfileName(p.name);
    setProfileForm({
      name: p.name,
      rateLimit: p["rate-limit"] ?? "",
      sharedUsers: p["shared-users"] ?? "",
      addressPool: p["address-pool"] ?? "",
      sessionTimeout: p["session-timeout"] && p["session-timeout"] !== "none" ? p["session-timeout"] : "",
      idleTimeout: p["idle-timeout"] && p["idle-timeout"] !== "none" ? p["idle-timeout"] : "",
    });
    setError("");
    setProfileModal("EDIT");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim()) { setError("Nama profil wajib diisi."); return; }
    setSaving(true);
    setError("");
    const res = editingProfileName
      ? await fetch(`/api/jaringan/hotspot-profiles/${encodeURIComponent(editingProfileName)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileForm) })
      : await fetch("/api/jaringan/hotspot-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileForm) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setProfileModal(null);
    loadAll();
  }

  async function handleDeleteProfile(name: string) {
    if (!await confirmDialog(`Hapus profil "${name}"? User yang masih memakai profil ini bisa bermasalah.`)) return;
    await fetch(`/api/jaringan/hotspot-profiles/${encodeURIComponent(name)}`, { method: "DELETE" });
    loadAll();
  }

  function openAddBinding() {
    setBindingForm({ macAddress: "", address: "", type: "bypassed", comment: "" });
    setError("");
    setBindingModal(true);
  }

  async function handleSaveBinding(e: React.FormEvent) {
    e.preventDefault();
    if (!bindingForm.macAddress.trim()) { setError("MAC address wajib diisi."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/jaringan/ip-bindings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bindingForm) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setBindingModal(false);
    loadAll();
  }

  async function handleDeleteBinding(id: string, mac: string) {
    if (!await confirmDialog(`Hapus IP binding untuk "${mac}"?`)) return;
    await fetch(`/api/jaringan/ip-bindings/${id}`, { method: "DELETE" });
    loadAll();
  }

  function loadTraffic() {
    fetch("/api/jaringan/traffic").then(r => r.json()).then(d => setTraffic(Array.isArray(d) ? d : [])).catch(() => {});
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (tab === "Bandwidth") {
      loadTraffic();
      const iv = setInterval(loadTraffic, 10000);
      return () => clearInterval(iv);
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "Ringkasan") return;
    function loadLogs() {
      fetch("/api/jaringan/log").then(r => r.json()).then(d => { if (Array.isArray(d)) setLogs(d); }).catch(() => {});
    }
    loadLogs();
    const iv = setInterval(loadLogs, 10000);
    return () => clearInterval(iv);
  }, [tab]);

  useEffect(() => {
    if (tab !== "Ringkasan" || !chartInterface || chartRange !== "live") return;
    function tick() {
      fetch(`/api/jaringan/traffic?interfaces=${encodeURIComponent(chartInterface)}`).then(r => r.json()).then(d => {
        const row = Array.isArray(d) ? d[0] : null;
        if (!row) return;
        const point: ChartPoint = {
          t: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          rx: Math.round(Number(row["rx-bits-per-second"] ?? 0) / 1_000_000 * 100) / 100,
          tx: Math.round(Number(row["tx-bits-per-second"] ?? 0) / 1_000_000 * 100) / 100,
        };
        chartDataRef.current = [...chartDataRef.current, point].slice(-MAX_CHART_POINTS);
        setChartData(chartDataRef.current);
        setChartTick(n => n + 1);
      }).catch(() => {});
    }
    chartDataRef.current = [];
    setChartData([]);
    setChartTick(0);
    tick();
    const iv = setInterval(tick, 4000);
    return () => clearInterval(iv);
  }, [tab, chartInterface, chartRange]);

  // Mode riwayat (bukan "live") — tarik SEKALI dari BandwidthLog (sudah teragregasi di server
  // sesuai rentang), tidak perlu polling ulang tiap beberapa detik seperti mode live.
  useEffect(() => {
    if (tab !== "Ringkasan" || !chartInterface || chartRange === "live") return;
    setHistoryLoading(true);
    fetch(`/api/jaringan/bandwidth-history?interface=${encodeURIComponent(chartInterface)}&range=${chartRange}`)
      .then(r => r.json())
      .then(d => {
        const fmt = (iso: string) => {
          const dt = new Date(iso);
          return chartRange === "30d" || chartRange === "7d"
            ? dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", ...(chartRange === "7d" ? { hour: "2-digit", minute: "2-digit" } : {}) })
            : dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        };
        const points: ChartPoint[] = Array.isArray(d.points) ? d.points.map((p: { t: string; rx: number; tx: number }) => ({ t: fmt(p.t), rx: p.rx, tx: p.tx })) : [];
        setChartData(points);
        setChartTick(n => n + 1);
      })
      .catch(() => setChartData([]))
      .finally(() => setHistoryLoading(false));
  }, [tab, chartInterface, chartRange]);

  function openAddUser(type: "HOTSPOT" | "PPPOE") {
    setUserForm(EMPTY_USER_FORM);
    setError("");
    setUserModal(type);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.password.trim()) { setError("Nama dan password wajib diisi."); return; }
    setSaving(true);
    setError("");
    const url = userModal === "HOTSPOT" ? "/api/jaringan/hotspot-users" : "/api/jaringan/pppoe-users";
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userForm) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setUserModal(null);
    loadAll();
  }

  async function handleDeleteUser(type: "HOTSPOT" | "PPPOE", id: string, name: string) {
    if (!await confirmDialog(`Hapus user ${type === "HOTSPOT" ? "hotspot" : "PPPoE"} "${name}"?`)) return;
    const url = type === "HOTSPOT" ? `/api/jaringan/hotspot-users/${id}` : `/api/jaringan/pppoe-users/${id}`;
    await fetch(url, { method: "DELETE" });
    loadAll();
  }

  async function handleKillSession(type: "HOTSPOT" | "PPPOE", id: string, name: string) {
    if (!await confirmDialog(`Putuskan koneksi "${name}" sekarang? Akunnya tidak dihapus, cuma sesi online-nya diputus.`)) return;
    const url = type === "HOTSPOT" ? `/api/jaringan/hotspot-active/${id}` : `/api/jaringan/pppoe-active/${id}`;
    await fetch(url, { method: "DELETE" });
    loadAll();
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageSkeleton statCount={4} rows={5} />
      </div>
    );
  }

  const q = search.toLowerCase();
  const filteredLeases = leases.filter(l =>
    !q || (l["host-name"] ?? "").toLowerCase().includes(q) || (l.address ?? "").includes(q) ||
    (l["mac-address"] ?? "").toLowerCase().includes(q) || (l.comment ?? "").toLowerCase().includes(q)
  );

  const printUsers = printProfile ? hotspot.users.filter(u => u.profile === printProfile).sort((a, b) => a.name.localeCompare(b.name)) : [];

  const hq = hotspotSearch.toLowerCase();
  const filteredHotspotUsers = hotspot.users.filter(u =>
    !hq || u.name.toLowerCase().includes(hq) || (u.profile ?? "").toLowerCase().includes(hq) || displayComment(u.comment).toLowerCase().includes(hq)
  );

  return (
    <>
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:hidden">
      <PageHeader
        icon={<Network size={22} />}
        title="Jaringan Sekolah"
        description="Monitoring & manajemen jaringan Mikrotik — status perangkat, bandwidth, hotspot, dan PPPoE"
      />

      <div className="flex justify-end mb-5">
        <button onClick={loadAll} className="inline-flex items-center gap-2 bg-primary-50 hover:bg-primary-100 text-primary-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors border border-primary-100">
          <RefreshCw size={15} /> Segarkan
        </button>
      </div>

      {connError && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
          Tidak bisa terhubung ke Mikrotik: {connError}
        </div>
      )}

      {tab === "Ringkasan" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatTile color="primary" icon={Users} value={hotspot.users.length} label="Total Akun Hotspot" size="md" />
          <StatTile color="emerald" icon={Wifi} value={hotspot.active.length} label="Online Sekarang" size="md" />
          <StatTile color="gray" icon={Users} value={Math.max(hotspot.users.length - hotspot.active.length, 0)} label="Offline" size="md" />
          <StatTile color="blue" icon={Router} value={status?.identity?.name ?? "—"} label="Router" size="sm" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors border ${
              tab === t ? "bg-primary-700 text-white border-primary-700" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Ringkasan" && (
        <div className="space-y-5">
          {status && (() => {
            const ramTotal = Number(status.resource["total-memory"] ?? 0);
            const ramFree = Number(status.resource["free-memory"] ?? 0);
            const ramPct = ramTotal ? Math.round(((ramTotal - ramFree) / ramTotal) * 100) : 0;
            const hddTotal = Number(status.resource["total-hdd-space"] ?? 0);
            const hddFree = Number(status.resource["free-hdd-space"] ?? 0);
            const hddPct = hddTotal ? Math.round(((hddTotal - hddFree) / hddTotal) * 100) : 0;
            const cpuPct = Number(status.resource["cpu-load"] ?? 0);
            const temp = status.health.find(h => h.name === "temperature")?.value;
            const barColor = (pct: number) => (pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#10b981");
            const bar = (pct: number) => (
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5 segmented-bar">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: barColor(pct) }} />
              </div>
            );
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold"><Cpu size={13} /> CPU Load</div>
                  <p className="text-xl font-heading font-bold text-primary-900 mt-1">{cpuPct}%</p>
                  {bar(cpuPct)}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold"><Gauge size={13} /> RAM Terpakai</div>
                  <p className="text-xl font-heading font-bold text-primary-900 mt-1">{ramPct}%</p>
                  {bar(ramPct)}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="relative w-14 h-14 shrink-0 rounded-full transition-all duration-700"
                    style={{ background: `conic-gradient(${barColor(hddPct)} ${hddPct * 3.6}deg, #f1f5f9 ${hddPct * 3.6}deg 360deg)` }}>
                    <div className="absolute inset-1.5 bg-white rounded-full flex items-center justify-center text-[0.65rem] font-bold text-primary-900">{hddPct}%</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold"><HardDrive size={13} /> Storage</div>
                    <p className="text-[0.68rem] text-gray-400 mt-1">Terpakai dari total kapasitas</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold"><Thermometer size={13} /> Suhu Perangkat</div>
                  <p className="text-xl font-heading font-bold text-primary-900 mt-1">{temp ? `${temp}°C` : "—"}</p>
                  <p className="text-[0.68rem] text-gray-400 mt-1.5">Uptime {status.resource.uptime} · RouterOS {status.resource.version}</p>
                </div>
              </div>
            );
          })()}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <span className="font-heading font-bold text-primary-900 text-sm flex items-center gap-1.5">
                <Activity size={15} className="text-emerald-500" /> Bandwidth {chartRange === "live" ? "Live" : "Riwayat"}
                {chartRange === "live" && <span className="live-dot text-emerald-500" />}
              </span>
              <Select className="sm:w-56" value={chartInterface} onChange={setChartInterface}
                options={(status?.interfaces ?? []).filter(i => i.disabled === "false").map(i => ({ value: i.name, label: i.name }))} />
            </div>
            <div className="flex items-center gap-1 mb-3 rounded-xl border border-gray-100 p-1 w-max">
              {([["live", "Live"], ["1h", "1 Jam"], ["24h", "24 Jam"], ["7d", "7 Hari"], ["30d", "30 Hari"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setChartRange(val)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartRange === val ? "bg-primary-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                  {label}
                </button>
              ))}
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-primary-400" /></div>
            ) : chartRange !== "live" && chartData.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">Belum ada data riwayat untuk rentang ini.</p>
            ) : null}
            {chartData.length > 0 && (
              <div className="flex items-center gap-6 mb-3">
                <div>
                  <p className="text-[0.68rem] text-gray-400 font-semibold">Download</p>
                  <p key={`rx-${chartTick}`} className="text-xl font-heading font-bold text-emerald-600 num-flash">
                    {chartData[chartData.length - 1].rx} Mbps
                  </p>
                </div>
                <div>
                  <p className="text-[0.68rem] text-gray-400 font-semibold">Upload</p>
                  <p key={`tx-${chartTick}`} className="text-xl font-heading font-bold text-primary-700 num-flash">
                    {chartData[chartData.length - 1].tx} Mbps
                  </p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E3F8F" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2E3F8F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} unit=" Mbps" width={65} />
                <Tooltip formatter={(v) => `${v} Mbps`} />
                <Area type="monotone" dataKey="rx" name="Download" stroke="#10b981" fill="url(#rxGrad)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" name="Upload" stroke="#2E3F8F" fill="url(#txGrad)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 font-heading font-bold text-primary-900 text-sm flex items-center gap-1.5">
                <Trophy size={15} className="text-gold" /> Pemakai Terbesar Saat Ini
              </div>
              {hotspot.active.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Belum ada yang online.</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {[...hotspot.active]
                    .sort((a, b) => (Number(b["bytes-in"] ?? 0) + Number(b["bytes-out"] ?? 0)) - (Number(a["bytes-in"] ?? 0) + Number(a["bytes-out"] ?? 0)))
                    .slice(0, 10)
                    .map((a, i) => (
                      <div key={a[".id"]} className="flex items-center justify-between px-5 py-2.5 text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-primary-50 text-primary-700 text-[0.65rem] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                          <span className="font-medium text-gray-800">{a.user}</span>
                        </div>
                        <span className="text-gray-400 text-xs font-mono">{fmtBytes(String(Number(a["bytes-in"] ?? 0) + Number(a["bytes-out"] ?? 0)))}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 font-heading font-bold text-primary-900 text-sm flex items-center gap-1.5">
                <Terminal size={15} className="text-primary-500" /> Aktivitas Terbaru <span className="live-dot text-primary-500" />
              </div>
              {logs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Memuat log...</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {logs.slice(0, 20).map((l) => (
                    <div key={l[".id"]} className="px-5 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded border ${logColor(l.topics)}`}>{l.topics.split(",")[0]}</span>
                        <span className="text-gray-300 text-[0.68rem]">{l.time}</span>
                      </div>
                      <p className="text-xs text-gray-600">{l.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "Status Perangkat" && status && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile color="primary" icon={Router} value={status.identity?.name ?? "—"} label="Identitas Router" size="sm" />
            <StatTile color="emerald" icon={Activity} value={status.resource?.uptime ?? "—"} label="Uptime" size="md" />
            <StatTile color="blue" icon={Network} value={status.resource?.version ?? "—"} label="RouterOS" size="md" />
            <StatTile color="amber" icon={Activity} value={`${status.resource?.["cpu-load"] ?? 0}%`} label="CPU Load" size="md" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 font-heading font-bold text-primary-900 text-sm">
              Interface ({status.interfaces.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Tipe</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Status</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">RX / TX Total</th>
                  </tr>
                </thead>
                <tbody>
                  {status.interfaces.map(i => (
                    <tr key={i[".id"]} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{i.name}</td>
                      <td className="px-5 py-3 text-gray-400">{i.type}</td>
                      <td className="px-5 py-3">
                        {i.disabled === "true"
                          ? <span className="text-gray-400 text-xs font-semibold">Nonaktif</span>
                          : i.running === "true"
                            ? <span className="text-emerald-600 text-xs font-semibold inline-flex items-center gap-1.5"><span className="live-dot" /> Aktif</span>
                            : <span className="text-red-500 text-xs font-semibold">● Terputus</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs hidden md:table-cell">{fmtBytes(i["rx-byte"])} / {fmtBytes(i["tx-byte"])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "Bandwidth" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 font-heading font-bold text-primary-900 text-sm flex items-center justify-between">
            <span>Traffic per Interface (live, refresh tiap 10 detik)</span>
          </div>
          {traffic.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">Memuat traffic...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Interface</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Download (RX)</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Upload (TX)</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.map(t => (
                    <tr key={t.name} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{t.name}</td>
                      <td className="px-5 py-3 text-emerald-600 font-mono text-xs">{fmtBits(t["rx-bits-per-second"])}</td>
                      <td className="px-5 py-3 text-blue-600 font-mono text-xs">{fmtBits(t["tx-bits-per-second"])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "Perangkat Terhubung" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile color="primary" icon={Users} value={leases.length} label="Total DHCP Lease" size="md" />
            <StatTile color="emerald" icon={Activity} value={leases.filter(l => l.status === "bound").length} label="Sedang Terhubung" size="md" />
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama perangkat, IP, MAC, atau catatan..."
              className="input-field pl-10" />
          </div>
          {filteredLeases.length === 0 ? (
            <EmptyState icon={Users} title="Tidak ada perangkat yang cocok" />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[65vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.08) 0%, rgba(27,43,107,0.05) 100%)" }}>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Perangkat</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">IP Address</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">MAC Address</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Status</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeases.slice(0, 300).map(l => (
                      <tr key={l[".id"]} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3 font-medium text-gray-800">{l["host-name"] || "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{l.address}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-400 hidden md:table-cell">{l["mac-address"]}</td>
                        <td className="px-5 py-3">
                          {l.status === "bound"
                            ? <span className="text-emerald-600 text-xs font-semibold">● Terhubung</span>
                            : <span className="text-gray-400 text-xs">{l.status}</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{l.comment || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredLeases.length > 300 && (
                <div className="px-5 py-2.5 text-xs text-gray-400 border-t border-gray-50">Menampilkan 300 dari {filteredLeases.length} — persempit pencarian untuk melihat lainnya.</div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "Hotspot" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile color="primary" icon={Users} value={hotspot.users.length} label="Total User Hotspot" size="md" />
            <StatTile color="emerald" icon={Wifi} value={hotspot.active.length} label="Sedang Online" size="md" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-heading font-bold text-primary-900 text-sm">Sinkronkan Akun Siswa, Guru & Pegawai</p>
                <p className="text-gray-400 text-xs mt-0.5">Buat/perbarui akun hotspot untuk semua siswa aktif (profil per kelas), guru (profil GURU), dan pegawai TAS/Admin (profil ADMIN) — username sesuai NIS/NIP/email. Akun yang pemiliknya sudah tidak aktif dinonaktifkan otomatis.</p>
              </div>
              <button onClick={handleSync} disabled={syncing}
                className="inline-flex items-center gap-1.5 bg-primary-700 hover:bg-primary-900 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg whitespace-nowrap disabled:opacity-60">
                {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sinkronkan Ulang
              </button>
            </div>
            {syncResult && (
              <div className="mt-3 space-y-2">
                <div className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-3 py-2">
                  Selesai: {syncResult.created} akun dibuat, {syncResult.updated} diperbarui, {syncResult.disabled} dinonaktifkan
                  {syncResult.profilesCreated > 0 && `, ${syncResult.profilesCreated} profil baru dibuat`}
                  {" "}(total {syncResult.totalAktif} akun diproses).
                </div>
                {syncResult.skipped > 0 && (
                  <div className="text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-lg px-3 py-2">
                    <p className="font-semibold mb-1">{syncResult.skipped} akun dilewati karena konflik:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {syncResult.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-heading font-bold text-primary-900 text-sm">Cetak Daftar Akun</p>
                <p className="text-gray-400 text-xs mt-0.5">Cetak daftar username & password per kelas/profil — untuk dibagikan ke siswa atau wali kelas.</p>
              </div>
              <div className="flex items-center gap-2">
                <Select className="w-48" value={printProfile} onChange={setPrintProfile}
                  options={[{ value: "", label: "Pilih profil..." }, ...profiles.map(p => ({ value: p.name, label: p.name }))]} />
                <button onClick={() => printProfile && window.print()} disabled={!printProfile}
                  className="inline-flex items-center gap-1.5 bg-primary-700 hover:bg-primary-900 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg whitespace-nowrap disabled:opacity-40">
                  <Printer size={13} /> Cetak
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <span className="font-heading font-bold text-primary-900 text-sm">Profil Hotspot ({profiles.length})</span>
              <button onClick={openAddProfile}
                className="inline-flex items-center gap-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-2 rounded-lg border border-primary-100">
                <Plus size={13} /> Tambah Profil
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Profil</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Rate Limit</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Shared Users</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Address Pool</th>
                    <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p[".id"]} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p["rate-limit"] || "Tidak dibatasi"}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs hidden md:table-cell">{p["shared-users"] ?? "1"}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs hidden md:table-cell">{p["address-pool"] || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditProfile(p)}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary-50 border border-primary-100">
                            <Edit2 size={12} /> Edit
                          </button>
                          {p.name !== "default" && (
                            <button onClick={() => handleDeleteProfile(p.name)}
                              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100">
                              <Trash2 size={12} /> Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <span className="font-heading font-bold text-primary-900 text-sm">IP Binding ({ipBindings.length})</span>
              <button onClick={openAddBinding}
                className="inline-flex items-center gap-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-2 rounded-lg border border-primary-100">
                <Plus size={13} /> Tambah Binding
              </button>
            </div>
            {ipBindings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Belum ada IP binding. Dipakai untuk lewatkan/blokir perangkat tertentu tanpa perlu login hotspot (mis. PC petugas, printer, CCTV).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">MAC Address</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">IP Address</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Tipe</th>
                      <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Catatan</th>
                      <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipBindings.map(b => (
                      <tr key={b[".id"]} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3 font-mono text-xs text-gray-700">{b["mac-address"]}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500 hidden md:table-cell">{b.address || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            b.type === "blocked" ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          }`}>{b.type === "blocked" ? "Diblokir" : b.type === "regular" ? "Regular" : "Dilewatkan"}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{b.comment || "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleDeleteBinding(b[".id"], b["mac-address"])}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100">
                            <Trash2 size={12} /> Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="font-heading font-bold text-primary-900 text-sm shrink-0">Daftar User Hotspot ({filteredHotspotUsers.length}{hotspotSearch ? ` dari ${hotspot.users.length}` : ""})</span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={hotspotSearch} onChange={e => setHotspotSearch(e.target.value)}
                    placeholder="Cari nama atau profil..." className="input-field pl-8 py-1.5 text-xs" />
                </div>
                <button onClick={() => openAddUser("HOTSPOT")}
                  className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold/90 text-primary-900 text-xs font-semibold px-3 py-2 rounded-lg shrink-0">
                  <Plus size={13} /> Tambah User
                </button>
              </div>
            </div>
            {filteredHotspotUsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Tidak ada user hotspot yang cocok dengan pencarian.</p>
            ) : (
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.08) 0%, rgba(27,43,107,0.05) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Profil</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Pemakaian</th>
                    <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHotspotUsers.map(u => (
                    <tr key={u[".id"]} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{u.name}{u.comment && <span className="text-gray-400 font-normal"> · {displayComment(u.comment)}</span>}</td>
                      <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{u.profile || "default"}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{fmtBytes(u["bytes-in"])} / {fmtBytes(u["bytes-out"])}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleDeleteUser("HOTSPOT", u[".id"], u.name)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100">
                          <Trash2 size={12} /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 font-heading font-bold text-primary-900 text-sm">Sesi Aktif ({hotspot.active.length})</div>
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.08) 0%, rgba(27,43,107,0.05) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">User</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">IP</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Uptime</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Pemakaian</th>
                    <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspot.active.slice(0, 200).map(a => (
                    <tr key={a[".id"]} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{a.user}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{a.address}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{a.uptime}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{fmtBytes(a["bytes-in"])} / {fmtBytes(a["bytes-out"])}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleKillSession("HOTSPOT", a[".id"], a.user)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100">
                          <Trash2 size={12} /> Putuskan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "PPPoE" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile color="primary" icon={Users} value={pppoe.secrets.length} label="Total User PPPoE" size="md" />
            <StatTile color="emerald" icon={Wifi} value={pppoe.active.length} label="Sedang Online" size="md" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <span className="font-heading font-bold text-primary-900 text-sm">Daftar User PPPoE</span>
              <button onClick={() => openAddUser("PPPOE")}
                className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold/90 text-primary-900 text-xs font-semibold px-3 py-2 rounded-lg">
                <Plus size={13} /> Tambah User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Layanan</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Profil</th>
                    <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pppoe.secrets.map(s => (
                    <tr key={s[".id"]} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{s.name}{s.comment && <span className="text-gray-400 font-normal"> · {s.comment}</span>}</td>
                      <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{s.service}</td>
                      <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{s.profile || "default"}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleDeleteUser("PPPOE", s[".id"], s.name)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100">
                          <Trash2 size={12} /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 font-heading font-bold text-primary-900 text-sm">Sesi Aktif ({pppoe.active.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">IP</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Uptime</th>
                    <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pppoe.active.map(a => (
                    <tr key={a[".id"]} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-800">{a.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{a.address}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{a.uptime}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleKillSession("PPPOE", a[".id"], a.name)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100">
                          <Trash2 size={12} /> Putuskan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal tambah user hotspot/pppoe */}
      <Modal
        open={userModal !== null}
        onClose={() => setUserModal(null)}
        title={userModal === "HOTSPOT" ? "Tambah User Hotspot" : "Tambah User PPPoE"}
        footer={
          <>
            <button type="button" onClick={() => setUserModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="userForm" disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
          </>
        }
      >
        <form id="userForm" onSubmit={handleSaveUser} className="flex flex-col gap-4">
          {error && <p className="error-msg">{error}</p>}
          <div>
            <label className="label-field">Nama User *</label>
            <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="cth: siswa01" />
          </div>
          <div>
            <label className="label-field">Password *</label>
            <input value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label-field">Profil (opsional)</label>
            <input value={userForm.profile} onChange={e => setUserForm(f => ({ ...f, profile: e.target.value }))} className="input-field" placeholder="Nama profil sesuai Mikrotik, kosongkan = default" />
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <input value={userForm.comment} onChange={e => setUserForm(f => ({ ...f, comment: e.target.value }))} className="input-field" />
          </div>
        </form>
      </Modal>

      {/* Modal tambah/edit profil hotspot */}
      <Modal scrollBody
        open={profileModal !== null}
        onClose={() => setProfileModal(null)}
        title={profileModal === "EDIT" ? `Edit Profil "${editingProfileName}"` : "Tambah Profil Hotspot"}
        footer={
          <>
            <button type="button" onClick={() => setProfileModal(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="profileForm" disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
          </>
        }
      >
        <form id="profileForm" onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          {error && <p className="error-msg">{error}</p>}
          <div>
            <label className="label-field">Nama Profil *</label>
            <input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="cth: X TKJ 1" disabled={profileModal === "EDIT"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Rate Limit</label>
              <input value={profileForm.rateLimit} onChange={e => setProfileForm(f => ({ ...f, rateLimit: e.target.value }))} className="input-field" placeholder="5M/5M" />
            </div>
            <div>
              <label className="label-field">Shared Users</label>
              <input value={profileForm.sharedUsers} onChange={e => setProfileForm(f => ({ ...f, sharedUsers: e.target.value }))} className="input-field" placeholder="1" type="number" min={1} />
            </div>
          </div>
          <div>
            <label className="label-field">Address Pool</label>
            <Select value={profileForm.addressPool} onChange={v => setProfileForm(f => ({ ...f, addressPool: v }))}
              options={[{ value: "", label: "— Tidak diatur —" }, ...ipPools.map(p => ({ value: p.name, label: `${p.name} (${p.ranges})` }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Session Timeout</label>
              <input value={profileForm.sessionTimeout} onChange={e => setProfileForm(f => ({ ...f, sessionTimeout: e.target.value }))} className="input-field" placeholder="cth: 8h, kosongkan = tidak diubah" />
            </div>
            <div>
              <label className="label-field">Idle Timeout</label>
              <input value={profileForm.idleTimeout} onChange={e => setProfileForm(f => ({ ...f, idleTimeout: e.target.value }))} className="input-field" placeholder="cth: 30m, kosongkan = tanpa batas" />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal tambah IP binding */}
      <Modal
        open={bindingModal}
        onClose={() => setBindingModal(false)}
        title="Tambah IP Binding"
        footer={
          <>
            <button type="button" onClick={() => setBindingModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="bindingForm" disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
          </>
        }
      >
        <form id="bindingForm" onSubmit={handleSaveBinding} className="flex flex-col gap-4">
          {error && <p className="error-msg">{error}</p>}
          <div>
            <label className="label-field">MAC Address *</label>
            <input value={bindingForm.macAddress} onChange={e => setBindingForm(f => ({ ...f, macAddress: e.target.value }))} className="input-field font-mono" placeholder="AA:BB:CC:DD:EE:FF" />
          </div>
          <div>
            <label className="label-field">IP Address (opsional)</label>
            <input value={bindingForm.address} onChange={e => setBindingForm(f => ({ ...f, address: e.target.value }))} className="input-field font-mono" placeholder="Kosongkan = perangkat dapat IP otomatis" />
          </div>
          <div>
            <label className="label-field">Tipe</label>
            <Select value={bindingForm.type} onChange={v => setBindingForm(f => ({ ...f, type: v }))}
              options={[
                { value: "bypassed", label: "Dilewatkan (tidak perlu login hotspot)" },
                { value: "blocked", label: "Diblokir (tidak bisa akses internet)" },
                { value: "regular", label: "Regular (tetap perlu login)" },
              ]} />
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <input value={bindingForm.comment} onChange={e => setBindingForm(f => ({ ...f, comment: e.target.value }))} className="input-field" placeholder="cth: PC Ruang TU" />
          </div>
        </form>
      </Modal>
    </div>

    {printProfile && (
      <div className="hidden print:block p-8">
        <h1 className="text-lg font-bold text-center mb-1">Daftar Akun WiFi Hotspot</h1>
        <p className="text-sm text-center text-gray-600 mb-6">Profil: {printProfile} — SMK Al-Munawwir IIBS</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-400 px-2 py-1.5 text-left">No</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">Nama</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">Username</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">Password</th>
            </tr>
          </thead>
          <tbody>
            {printUsers.map((u, i) => (
              <tr key={u[".id"]}>
                <td className="border border-gray-400 px-2 py-1.5">{i + 1}</td>
                <td className="border border-gray-400 px-2 py-1.5">{displayComment(u.comment)}</td>
                <td className="border border-gray-400 px-2 py-1.5 font-mono">{u.name}</td>
                <td className="border border-gray-400 px-2 py-1.5 font-mono">{u.password ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    </>
  );
}
