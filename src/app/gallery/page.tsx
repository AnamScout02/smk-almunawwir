import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import GalleryGrid from "@/components/sections/GalleryGrid";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Galeri — SMK Al Munawwir IIBS",
  description: "Foto kegiatan, fasilitas, dan kehidupan boarding school SMK Al Munawwir IIBS.",
};

const content = {
  id: {
    label: "Galeri",
    title: "Foto & Kegiatan",
    desc: "Sekilas kehidupan dan fasilitas SMK Al Munawwir IIBS",
  },
  en: {
    label: "Gallery",
    title: "Photos & Activities",
    desc: "A glimpse of life and facilities at SMK Al Munawwir IIBS",
  },
} as const;

export default async function GalleryPage() {
  const lang = await getLang();
  const c = content[lang];
  let items: Awaited<ReturnType<typeof prisma.gallery.findMany>> = [];
  try {
    items = await prisma.gallery.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  } catch { /* DB unavailable */ }

  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">{c.title}</h1>
            <p className="text-white/70 text-lg">{c.desc}</p>
          </div>
        </section>
        <GalleryGrid items={items} lang={lang} />
      </main>
      <Footer />
    </>
  );
}
