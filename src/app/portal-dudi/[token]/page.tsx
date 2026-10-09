import PortalDudi from "@/components/pkl/PortalDudi";

export const metadata = { title: "Portal Industri PKL", robots: { index: false, follow: false } };

/** Portal pembimbing industri — tanpa akun, lewat tautan rahasia per DUDI (dibuat Humas di Pusat PKL → Data DUDI). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalDudi token={token} />;
}
