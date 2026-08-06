/** Primitif skeleton loading (kotak abu-abu berkedip) — pengganti spinner polos "Memuat data..."
 * supaya bentuk halaman sudah kelihatan sebelum data asli datang. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/** Skeleton baris StatTile (grid kartu ringkasan angka). */
export function StatTileSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl p-4 bg-gray-100 animate-pulse h-[86px]" />
      ))}
    </div>
  );
}

/** Skeleton baris tabel (mis. daftar siswa/buku/dsb). */
export function TableRowsSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 0 ? "w-1/4" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton gabungan default untuk halaman Manager (StatTile + tabel) — dipakai saat loading awal. */
export function PageSkeleton({ statCount = 4, rows = 6 }: { statCount?: number; rows?: number }) {
  return (
    <div className="space-y-5">
      <StatTileSkeleton count={statCount} />
      <TableRowsSkeleton rows={rows} />
    </div>
  );
}
