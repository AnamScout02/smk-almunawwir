"use client";
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { daftarkanPasskey, passkeyDidukung } from "@/lib/passkey-klien";

type Passkey = { id: string; nama: string; rpId: string; createdAt: string; terakhirDipakai: string | null };

/** Kartu PASSKEY di halaman Profil (5 Oktober 2026, src/lib/passkey.ts): daftarkan sidik jari / wajah / PIN perangkat
 *  untuk masuk tanpa kata sandi, lihat & hapus perangkat yang terdaftar. Akun siswa tidak menampilkan kartu ini. */
export default function KelolaPasskey() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<{ boleh: boolean; daftar: Passkey[]; domainAman: boolean; domain: string | null } | null>(null);
  const [didukung, setDidukung] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [nama, setNama] = useState("");

  const muat = useCallback(() => {
    fetch("/api/passkey", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => d && setData(d)).catch(() => {});
  }, []);
  useEffect(() => {
    muat();
    queueMicrotask(() => setDidukung(passkeyDidukung()));
  }, [muat]);

  if (!data?.boleh) return null;

  async function tambah() {
    setSibuk(true);
    const galat = await daftarkanPasskey(nama);
    setSibuk(false);
    if (galat) { toast.error(galat); return; }
    toast.success("Passkey terdaftar — lain kali bisa masuk dengan sidik jari / wajah.");
    setNama(""); muat();
  }

  async function hapus(p: Passkey) {
    if (!await confirm(`Hapus passkey "${p.nama}"? Perangkat itu tidak bisa lagi dipakai masuk tanpa kata sandi.`)) return;
    const r = await fetch(`/api/passkey?id=${p.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Passkey dihapus"); muat(); } else toast.error("Gagal menghapus.");
  }

  const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  const bisaTambah = didukung && data.domainAman;

  return (
    <div className="panel p-6">
      <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2"><Fingerprint size={18} /> Passkey (sidik jari / wajah)</h3>
      <p className="mt-1 text-sm text-gray-500">
        Masuk tanpa mengetik kata sandi, memakai kunci layar perangkat ini. Kata sandi lama tetap berlaku.
      </p>

      {data.daftar.length > 0 && (
        <div className="mt-4 divide-y divide-gray-50">
          {data.daftar.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><KeyRound size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary-900">{p.nama}</p>
                <p className="text-xs text-gray-500">
                  Dibuat {tgl(p.createdAt)} · {p.terakhirDipakai ? `terakhir dipakai ${tgl(p.terakhirDipakai)}` : "belum pernah dipakai"}
                  {data.domain && p.rpId !== data.domain ? ` · berlaku di ${p.rpId}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => hapus(p)} title="Hapus"
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {bisaTambah ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={nama} onChange={e => setNama(e.target.value)} maxLength={60} placeholder="Nama perangkat, mis. HP Samsung"
            className="input-field flex-1" />
          <button type="button" onClick={tambah} disabled={sibuk} className="btn-modal-save btn-teks">
            {sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Tambah Passkey
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {!data.domainAman
            ? "Passkey hanya bisa ditambahkan lewat alamat aman https://smkalmunawwiriibs.sch.id — buka halaman ini dari alamat itu."
            : "Peramban/perangkat ini belum mendukung passkey. Coba Chrome, Edge, atau Safari versi terbaru."}
        </p>
      )}
    </div>
  );
}
