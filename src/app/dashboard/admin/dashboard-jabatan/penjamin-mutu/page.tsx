import WakasekPenjaminMutuDashboard from "@/components/jabatan/WakasekPenjaminMutuDashboard";

/** Salinan portal ADMIN dari dashboard jabatan di portal guru (19 September 2026). Superadmin
 * bukan guru/pegawai, jadi ia melihat dashboard ini TANPA dilempar ke shell portal guru. Isinya
 * komponen yang sama persis — bukan duplikat kode. */
export default function Page() {
  return <WakasekPenjaminMutuDashboard />;
}
