import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { aksesForm, muatForm } from "@/lib/rapor-form-server";
import { hitungSiswa, katrol } from "@/lib/rapor-form";
import PrintButton from "@/components/shared/PrintButton";
import { TautanIkon } from "@/components/shared/IkonNama";

/** FORM NILAI KATROL — padanan "FORM KATROL_Fiks.xlsx" sekolah: nilai asli → hasil perbaikan per lingkup materi & SAS
 * dengan rumus KKM + nilai × (100 − KKM) ÷ 100 (STS tidak dikatrol). Bukti pendukung ketika form nilai rapor memakai katrol. */
export default async function CetakFormKatrol({ classId, subject, semester, kembaliHref }: {
  classId: string; subject: string; semester: string; kembaliHref: string;
}) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const akses = await aksesForm(session, classId, subject);
  const data = akses ? await muatForm(classId, subject, semester) : null;
  if (!data) return <div className="p-8 text-sm text-gray-600">Form tidak ditemukan atau Anda tidak berhak membukanya.</div>;
  const st = await getSettings(["nominatif.kabKota"]);
  const f = data.pengaturan;
  const lm = f.lm.filter(l => l.teks.trim());
  const rata = (a: (number | null | undefined)[]) => { const x = a.filter((n): n is number => typeof n === "number"); return x.length ? Math.round((x.reduce((p, c) => p + c, 0) / x.length) * 100) / 100 : null; };
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <div className="p-4 lg:p-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>
      <div className="flex flex-wrap justify-end gap-2 mb-4 print:hidden">
        <TautanIkon href={kembaliHref} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
        <PrintButton />
      </div>
      <div className="print-doc bg-white mx-auto max-w-[287mm] p-6 print:p-0 text-[12px] text-black">
        <h1 className="text-center font-bold text-base uppercase">Form Nilai Katrol</h1>
        <p className="text-center text-sm">{subject} — Kelas {data.kelas.nama} — {semester}</p>
        <p className="text-center text-xs mb-3">KKM {f.kkm} · Kriteria: nilai asli x → {f.kkm} + x × (100 − {f.kkm}) ÷ 100 · STS tidak dikatrol</p>
        <table className="w-full border-collapse [&_td]:border [&_th]:border [&_td]:border-black [&_th]:border-black [&_td]:px-1 [&_th]:px-1 [&_td]:py-0.5">
          <thead>
            <tr>
              <th rowSpan={2} className="w-8">No</th><th rowSpan={2} className="text-left">Nama Siswa</th>
              <th colSpan={lm.length + 1}>Nilai Asli</th><th colSpan={lm.length + 1}>Hasil Perbaikan</th>
              <th rowSpan={2}>Nilai Akhir Asli</th><th rowSpan={2}>Nilai Akhir Katrol</th>
            </tr>
            <tr>
              {lm.map(l => <th key={`a${l.kode}`}>{l.kode.replace("LM-", "LM ")}</th>)}<th>SAS</th>
              {lm.map(l => <th key={`k${l.kode}`}>{l.kode.replace("LM-", "LM ")}</th>)}<th>SAS</th>
            </tr>
          </thead>
          <tbody>
            {data.siswa.map((s, i) => {
              const v = data.nilai[s.id] ?? {};
              const asli = lm.map(l => rata([v.lm?.[l.kode]?.tes, v.lm?.[l.kode]?.nonTes]));
              const kat = lm.map(l => rata([katrol(v.lm?.[l.kode]?.tes, f.kkm), katrol(v.lm?.[l.kode]?.nonTes, f.kkm)]));
              const h = hitungSiswa({ ...f, katrol: true }, v, s.nama);
              return (
                <tr key={s.id}>
                  <td className="text-center">{i + 1}</td><td>{s.nama}</td>
                  {asli.map((n, k) => <td key={`a${k}`} className="text-center">{fmt(n)}</td>)}<td className="text-center">{fmt(v.sasTes)}</td>
                  {kat.map((n, k) => <td key={`k${k}`} className="text-center">{fmt(n)}</td>)}<td className="text-center">{fmt(katrol(v.sasTes, f.kkm))}</td>
                  <td className="text-center">{h.hpaAsli ?? ""}</td><td className="text-center font-bold">{h.hpa ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-6 flex justify-end">
          <div className="text-center w-64">
            <p>{st["nominatif.kabKota"] || ""}{st["nominatif.kabKota"] ? ", " : ""}{tanggal}</p>
            <p>Guru Mata Pelajaran</p>
            <p className="mt-16 font-bold underline">{data.guru ?? "...................................."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
