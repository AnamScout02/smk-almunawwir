"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Laptop, Loader2, LogOut, MonitorSmartphone, Save, Search, ShieldCheck, Smartphone, UserCog, Users, AlertTriangle, Lock,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface Sesi {
  id: string; userId: string; nama: string; email: string; peran: string; label: string; seluler: boolean;
  ip: string | null; masuk: string; aktif: string; ingatSaya: boolean; perangkatIni: boolean; masukSebagai: string | null;
}
interface Data { https: boolean; sesiTunggal: string[]; dicabut24j: number; sesi: Sesi[] }

const PERAN: { value: string; label: string; ket: string }[] = [
  { value: "STUDENT", label: "Siswa", ket: "Mencegah satu akun dipakai bergantian / dijokikan saat ujian." },
  { value: "TEACHER", label: "Guru", ket: "" },
  { value: "TAS", label: "Tata Usaha", ket: "" },
  { value: "PARENT", label: "Orang Tua", ket: "" },
  { value: "ADMIN", label: "Administrator", ket: "" },
];
const LABEL_PERAN: Record<string, string> = Object.fromEntries(PERAN.map(p => [p.value, p.label]));
const tanggal = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const aktifBaru = (d: string) => Date.now() - new Date(d).getTime() < 16 * 60_000;

/** KEAMANAN & SESI LOGIN — padanan pusat kendali sesi di cetak biru autentikasi. */
export default function KeamananSesiManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [pilihan, setPilihan] = useState<string[]>([]);
  const [simpan, setSimpan] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [peran, setPeran] = useState("");

  const muat = useCallback(() => {
    fetch("/api/admin/keamanan-sesi")
      .then(r => r.json())
      .then((d: Data) => { if (Array.isArray(d.sesi)) { setData(d); setPilihan(d.sesiTunggal); } })
      .catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.sesi ?? []).filter(s =>
      (!peran || s.peran === peran) &&
      (!q || s.nama.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.ip ?? "").includes(q)));
  }, [data, cari, peran]);

  async function simpanKebijakan() {
    setSimpan(true);
    try {
      const r = await fetch("/api/admin/keamanan-sesi", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sesiTunggal: pilihan }),
      });
      const j = await r.json();
      if (!r.ok) toast.error(j.error ?? "Gagal menyimpan.");
      else { toast.success("Kebijakan sesi disimpan. Berlaku untuk login berikutnya."); muat(); }
    } catch { toast.error("Gagal menghubungi server."); }
    finally { setSimpan(false); }
  }

  async function cabut(body: { id?: string; userId?: string }, tanya: string) {
    if (!(await confirmDialog(tanya))) return;
    setSibuk(body.id ?? body.userId ?? null);
    try {
      const r = await fetch("/api/admin/keamanan-sesi", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) toast.error(j.error ?? "Gagal mencabut sesi.");
      else { toast.success(`${j.jumlah} sesi dicabut — pemiliknya langsung harus login ulang.`); muat(); }
    } catch { toast.error("Gagal menghubungi server."); }
    finally { setSibuk(null); }
  }

  const berubah = data && JSON.stringify([...pilihan].sort()) !== JSON.stringify([...data.sesiTunggal].sort());

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldCheck size={22} />} title="Keamanan & Sesi Login"
        description="Siapa sedang masuk dari perangkat apa, cabut sesi, dan batasi satu akun satu perangkat" />

      {!data ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
        <div className="space-y-5">
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile value={data.sesi.length} label="Sesi Aktif" icon={MonitorSmartphone} color="primary" />
            <StatTile value={data.sesi.filter(s => aktifBaru(s.aktif)).length} label="Aktif 15 Menit Terakhir" icon={Users} color="emerald" />
            <StatTile value={data.sesi.filter(s => s.masukSebagai).length} label="Sedang Masuk Sebagai" icon={UserCog} color="amber" />
            <StatTile value={data.dicabut24j} label="Dicabut / Keluar 24 Jam" icon={LogOut} color="gray" />
          </div>

          {/* ——— kebijakan ——— */}
          <div className="page-card">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-primary-700" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Satu Akun, Satu Perangkat</h2>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Untuk peran yang dicentang, login di perangkat baru otomatis mengeluarkan perangkat lama — langsung pada
                klik berikutnya di perangkat lama itu. Berlaku untuk login yang terjadi setelah disimpan.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PERAN.map(p => (
                  <label key={p.value} className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${pilihan.includes(p.value) ? "border-primary-300 bg-primary-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={pilihan.includes(p.value)} className="mt-0.5"
                      onChange={e => setPilihan(v => e.target.checked ? [...v, p.value] : v.filter(x => x !== p.value))} />
                    <span>
                      <span className="text-sm font-semibold text-gray-800">{p.label}</span>
                      {p.ket && <span className="block text-xs text-gray-500 leading-snug mt-0.5">{p.ket}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={simpanKebijakan} disabled={!berubah || simpan} className="btn-modal-save">
                  {simpan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Kebijakan
                </button>
              </div>
            </div>
          </div>

          {!data.https && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700 leading-relaxed">
                <p className="font-semibold text-amber-800">Halaman ini sedang dibuka lewat HTTP</p>
                Cookie sesi sudah HttpOnly + SameSite. Tanda <strong>Secure</strong> dipasang otomatis per perangkat: hanya
                untuk yang membuka situs lewat alamat HTTPS — di HTTP browser akan menolak cookie itu dan tidak ada yang bisa
                login. Login sidik jari/Face ID (passkey) juga baru bisa dipakai lewat alamat HTTPS.
              </div>
            </div>
          )}

          {/* ——— daftar sesi ——— */}
          <div className="page-card">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <MonitorSmartphone size={16} className="text-primary-700" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Sesi Aktif</h2>
              </div>
              <span className="text-xs text-gray-400">{tampil.length} dari {data.sesi.length}</span>
            </div>
            <div className="px-5 pt-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, email, atau IP..." className="input-field pl-10" />
              </div>
              <div className="sm:w-56">
                <Select value={peran} onChange={setPeran} placeholder="Semua peran"
                  options={[{ value: "", label: "Semua peran" }, ...PERAN.map(p => ({ value: p.value, label: p.label }))]} />
              </div>
            </div>
            {tampil.length === 0 ? (
              <EmptyState icon={MonitorSmartphone} title="Tidak ada sesi" description="Tidak ada sesi aktif yang cocok dengan saringan." />
            ) : (
              <div className="overflow-x-auto scrollbar-visible p-5">
                <table className="data-table">
                  <thead><tr>
                    <th>Pengguna</th><th>Perangkat</th><th>Masuk</th><th>Aktif Terakhir</th><th className="text-right">Tindakan</th>
                  </tr></thead>
                  <tbody>
                    {tampil.map(s => {
                      const Ikon = s.seluler ? Smartphone : Laptop;
                      return (
                        <tr key={s.id}>
                          <td>
                            <p className="font-semibold text-gray-800">{s.nama}</p>
                            <p className="text-xs text-gray-400">{LABEL_PERAN[s.peran] ?? s.peran} · {s.email}</p>
                            {s.masukSebagai && (
                              <span className="status-badge bg-amber-50 text-amber-700 border-amber-200 mt-1">Masuk sebagai {s.masukSebagai}</span>
                            )}
                          </td>
                          <td>
                            <p className="flex items-center gap-1.5 text-gray-700"><Ikon size={14} className="text-gray-400" /> {s.label}</p>
                            <p className="text-xs text-gray-400">
                              {s.ip ?? "-"}
                              {s.ingatSaya && <span className="text-blue-600"> · ingat saya</span>}
                              {s.perangkatIni && <span className="text-emerald-600 font-semibold"> · perangkat Anda</span>}
                            </p>
                          </td>
                          <td className="text-xs text-gray-500">{tanggal(s.masuk)}</td>
                          <td className="text-xs">
                            {aktifBaru(s.aktif)
                              ? <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold"><span className="live-dot w-2 h-2 rounded-full bg-emerald-500" /> sedang aktif</span>
                              : <span className="text-gray-500">{tanggal(s.aktif)}</span>}
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              {!s.perangkatIni && (
                                <button onClick={() => cabut({ id: s.id }, `Cabut sesi ${s.nama} di ${s.label}? Perangkat itu langsung keluar.`)}
                                  disabled={!!sibuk} title="Cabut sesi ini"
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-40">
                                  {sibuk === s.id ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                                </button>
                              )}
                              <button onClick={() => cabut({ userId: s.userId }, `Keluarkan ${s.nama} dari SEMUA perangkat?`)}
                                disabled={!!sibuk} title="Keluarkan dari semua perangkat"
                                className="px-2 py-1 text-xs font-semibold text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-40">
                                Semua
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
