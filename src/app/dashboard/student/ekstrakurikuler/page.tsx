import { verifyRole } from "@/lib/dal";
import EkstraSaya from "@/components/ekstra/EkstraSaya";

export const metadata = { title: "Ekstrakurikuler" };

export default async function Page() {
  await verifyRole(["STUDENT"]);
  return <EkstraSaya />;
}
