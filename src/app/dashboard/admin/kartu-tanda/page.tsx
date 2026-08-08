export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { KARTU_TEMPLATE_KEY, KartuTemplate, emptyKartuTemplate } from "@/lib/kartu-tanda-template";
import KartuTandaSheet from "@/components/shared/KartuTandaSheet";

export default async function KartuTandaPage() {
  await verifyTasAccess();

  const [classes, settings, templateRow] = await Promise.all([
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
    getSettings(["logo.emblem", "letterhead.ttdKepalaSekolah", "school.structure", "contact.address", "contact.phone", "contact.email"]),
    prisma.siteSetting.findUnique({ where: { key: KARTU_TEMPLATE_KEY } }).catch(() => null),
  ]);

  let template: KartuTemplate = emptyKartuTemplate();
  if (templateRow) {
    try {
      const parsed = JSON.parse(templateRow.value) as Partial<KartuTemplate>;
      template = { front: parsed.front ?? { imageUrl: "", boxes: [] }, back: parsed.back ?? { imageUrl: "", boxes: [] } };
    } catch { /* ignore corrupt value, pakai template kosong (fallback ke desain bawaan) */ }
  }

  return (
    <KartuTandaSheet
      classes={classes}
      template={template}
      logoEmblem={settings["logo.emblem"]}
      signatureUrl={settings["letterhead.ttdKepalaSekolah"] || undefined}
      principalName={getPrincipalName(settings["school.structure"])}
      address={settings["contact.address"]}
      phone={settings["contact.phone"]}
      email={settings["contact.email"]}
    />
  );
}
