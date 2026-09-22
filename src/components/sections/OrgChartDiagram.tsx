interface OrgBox {
  label: string;
  name?: string;
}

function Box({ label, name }: OrgBox) {
  return (
    <div className="rounded-md overflow-hidden shadow-sm w-full">
      <div className="bg-primary-900 text-white text-xs sm:text-xs font-bold uppercase tracking-wide px-2 sm:px-3 py-2 text-center leading-tight">
        {label}
      </div>
      {name && (
        <div className="bg-gold text-primary-900 text-xs sm:text-xs font-semibold px-2 sm:px-3 py-1.5 text-center leading-tight">
          {name}
        </div>
      )}
    </div>
  );
}

/** Bar konektor: garis vertikal turun dari tengah baris di atas, lalu bercabang (garis horizontal +
 * cabang vertikal) ke tiap kotak baris DI BAWAHNYA — `branches` HARUS jumlah kotak baris tujuan
 * (baris berikutnya), bukan baris sebelumnya, supaya cabangnya lurus ke tengah tiap kotak. */
function Connector({ branches }: { branches: number }) {
  return (
    <div className="relative h-6 sm:h-7">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 h-1/2 w-px bg-primary-300" />
      {branches > 1 ? (
        <>
          <div className="absolute top-1/2 -translate-y-1/2 border-t-2 border-solid border-primary-300"
            style={{ left: `${50 / branches}%`, right: `${50 / branches}%` }} />
          {Array.from({ length: branches }).map((_, i) => (
            <div key={i} className="absolute bottom-0 w-px h-1/2 bg-primary-300"
              style={{ left: `${((i + 0.5) / branches) * 100}%` }} />
          ))}
        </>
      ) : (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-1/2 w-px bg-primary-300" />
      )}
    </div>
  );
}

export default function OrgChartDiagram({
  kepalaSekolah, row2, row3, waliKelas, guruMapel, lang = "id",
}: {
  lang?: "id" | "en";
  kepalaSekolah: OrgBox;
  row2: OrgBox[];
  row3: OrgBox[];
  waliKelas: OrgBox[];
  guruMapel: string;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[760px] px-2">
        {/* Baris 1: DU/DI — Kepala Sekolah — Komite Sekolah */}
        <div className="grid grid-cols-3 gap-6 items-start">
          <Box label={lang === "en" ? "Business & Industry (DU/DI)" : "Dunia Usaha / Dunia Industri"} />
          <Box label={kepalaSekolah.label} name={kepalaSekolah.name} />
          <Box label={lang === "en" ? "School Committee" : "Komite Sekolah"} />
        </div>
        <div className="relative h-7">
          <div className="absolute top-0 h-1/2 w-px bg-primary-300 left-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed border-primary-300" style={{ left: "16.67%", right: "16.67%" }} />
        </div>
        <Connector branches={row2.length} />

        {/* Baris 2 */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${row2.length}, minmax(0,1fr))` }}>
          {row2.map(b => <Box key={b.label} {...b} />)}
        </div>
        <Connector branches={row3.length} />

        {/* Baris 3 */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${row3.length}, minmax(0,1fr))` }}>
          {row3.map(b => <Box key={b.label} {...b} />)}
        </div>
        <Connector branches={waliKelas.length} />

        {/* Baris 4: Wali Kelas */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${waliKelas.length}, minmax(0,1fr))` }}>
          {waliKelas.map(b => <Box key={b.label} {...b} />)}
        </div>
        <Connector branches={1} />

        {/* Baris 5: Guru Mapel */}
        <Box label={lang === "en" ? "Subject Teachers" : "Guru Mata Pelajaran"} name={guruMapel} />
      </div>
    </div>
  );
}
