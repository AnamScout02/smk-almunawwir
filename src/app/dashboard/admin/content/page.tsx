import { verifyRole } from "@/lib/dal";
import { DEFAULTS, getSettings } from "@/lib/site-settings";
import ContentEditor from "@/components/admin/ContentEditor";
import LogoEditor from "@/components/admin/LogoEditor";
import PageHeader from "@/components/admin/PageHeader";
import Alert from "@/components/admin/Alert";
import { FileText, ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  await verifyRole(["ADMIN"]);
  const settings = await getSettings([...Object.keys(DEFAULTS), "logo.emblem", "logo.full", "logo.full_white", "letterhead.bukuInduk"]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 min-h-screen">
      <PageHeader
        icon={<FileText size={22} />}
        title="Konten Halaman"
        description="Edit teks, angka, dan logo yang tampil di website"
      />

      <div className="space-y-10">
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
            letterheadBukuInduk={settings["letterhead.bukuInduk"]}
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
          <Alert variant="warning" className="mb-4">
            Perubahan akan langsung tampil di website setelah disimpan. Klik <strong>Simpan</strong> per baris untuk menyimpan satu per satu.
          </Alert>
          <ContentEditor initialSettings={settings} />
        </section>
      </div>
    </div>
  );
}
