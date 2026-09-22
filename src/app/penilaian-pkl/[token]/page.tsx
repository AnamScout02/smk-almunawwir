import FormPenilaianPkl from "@/components/pkl/FormPenilaianPkl";

export const metadata = { title: "Penilaian PKL", robots: { index: false, follow: false } };

/** Formulir penilaian untuk pembimbing industri — tanpa akun, lewat tautan rahasia berbatas waktu. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormPenilaianPkl token={token} />;
}
