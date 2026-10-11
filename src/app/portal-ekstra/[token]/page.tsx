import PortalEkstra from "@/components/ekstra/PortalEkstra";

export const metadata = { title: "Portal Pembina Ekstrakurikuler", robots: { index: false, follow: false } };

/** Portal pembina ekstrakurikuler — tanpa akun, lewat tautan rahasia per ekskul (dibuat koordinator di Pusat Ekstrakurikuler). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalEkstra token={token} />;
}
