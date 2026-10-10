import { DomainSearch, type DomainTldPrice } from "@/components/domain/domain-search";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";

export type { DomainTldPrice };

interface DomainSearchSectionProps {
  tlds: DomainTldPrice[];
  /** Section id used as the hero's "#alan-adi" anchor. */
  id?: string;
}

/** Homepage domain search: the shared search-as-you-type box with this section's own heading. */
export function DomainSearchSection({ tlds, id = "alan-adi" }: DomainSearchSectionProps) {
  return (
    <Section id={id} tone="muted" divider className="scroll-mt-20">
      <SectionHeading
        align="center"
        eyebrow="Alan adı"
        title="Markanıza uygun alan adını bulun"
        description="Alan adınızı yazın, desteklenen uzantılarda kayıt durumunu ve yıllık fiyatı tek seferde görün."
        className="mb-10"
      />
      <div className="mx-auto max-w-3xl">
        <DomainSearch tlds={tlds} chips={6} />
      </div>
    </Section>
  );
}
