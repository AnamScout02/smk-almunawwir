import { verifyRole } from "@/lib/dal";
import { DEFAULTS, getSettings } from "@/lib/site-settings";
import ContentEditor from "@/components/admin/ContentEditor";
import LogoEditor from "@/components/admin/LogoEditor";
import PageHeader from "@/components/admin/PageHeader";
import { FileText, ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  await verifyRole(["ADMIN"]);
  const settings = await getSettings([...Object.keys(DEFAULTS), "logo.emblem", "logo.full", "logo.full_white"]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 min-h-screen">
      <PageHeader
        icon={<FileText size={22} />}
        title="Konten Halaman"
        description="Edit teks, angka, dan logo yang tampil di website"
      />

      <div className="max-w-4xl mx-auto space-y-10">
        {/* Logo Section */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
              <ImageIcon size={14} className="text-primary-700" />
            </div>
            <h2 className="font-heading text-base font-semibold text-navy">Logo Sekolah</h2>
          </div>
          <LogoEditor
            logoEmblem={settings["logo.emblem"]}
            logoFull={settings["logo.full"]}
            logoFullWhite={settings["logo.full_white"]}
          />
        </section>

        {/* Content Section */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
              <FileText size={14} className="text-primary-700" />
            </div>
            <h2 className="font-heading text-base font-semibold text-navy">Teks & Konten</h2>
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
