import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import GalleryGrid from "@/components/sections/GalleryGrid";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Galeri — SMK Al-Munawwir IIBS",
  description: "Foto kegiatan, fasilitas, dan kehidupan boarding school SMK Al-Munawwir IIBS.",
};

export default async function GalleryPage() {
  let items: Awaited<ReturnType<typeof prisma.gallery.findMany>> = [];
  try {
    items = await prisma.gallery.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  } catch { /* DB unavailable */ }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16">
          <div className="container-custom text-center">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">Galeri</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">Foto & Kegiatan</h1>
            <p className="text-white/70 text-lg">Sekilas kehidupan dan fasilitas SMK Al-Munawwir IIBS</p>
          </div>
        </section>
        <GalleryGrid items={items} />
      </main>
      <Footer />
    </>
  );
}
