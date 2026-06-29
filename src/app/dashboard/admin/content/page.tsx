import { verifyRole } from "@/lib/dal";
import { DEFAULTS, getSettings } from "@/lib/site-settings";
import ContentEditor from "@/components/admin/ContentEditor";
import LogoEditor from "@/components/admin/LogoEditor";
import { FileText, ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  await verifyRole(["ADMIN"]);
  const settings = await getSettings([...Object.keys(DEFAULTS), "logo.emblem", "logo.full", "logo.full_white"]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-gray-100 px-6 lg:px-8 py-5 pt-16 lg:pt-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
            <FileText size={18} className="text-primary-700" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-navy">Konten Halaman</h1>
            <p className="text-gray-400 text-xs">Edit teks, angka, dan logo yang tampil di website</p>
          </div>
        </div>
      </header>

      <div className="px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-10">
        {/* Logo Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon size={16} className="text-primary-700" />
            <h2 className="font-heading text-base font-bold text-navy">Logo Sekolah</h2>
          </div>
          <LogoEditor
            logoEmblem={settings["logo.emblem"]}
            logoFull={settings["logo.full"]}
            logoFullWhite={settings["logo.full_white"]}
          />
        </section>

        {/* Content Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-primary-700" />
            <h2 className="font-heading text-base font-bold text-navy">Teks & Konten</h2>
          </div>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
            Perubahan akan langsung tampil di website setelah disimpan. Klik <strong>Simpan</strong> per baris untuk menyimpan satu per satu.
          </div>
          <ContentEditor initialSettings={settings} />
        </section>
      </div>
    </div>
  );
}
