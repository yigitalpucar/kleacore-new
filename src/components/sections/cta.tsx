import { CtaBand } from "@/components/site/cta-band";

/** Generic closing CTA used on marketing pages. */
export function CTA() {
  return (
    <CtaBand
      eyebrow="Başlayın"
      title="Web sitenizi bugün yayına alın"
      description="Alan adınızı kaydedin, hosting paketinizi seçin; cPanel, LiteSpeed ve ücretsiz Let's Encrypt SSL ile hemen başlayın."
      primary={{ label: "Hosting paketlerini incele", href: "/hosting/linux" }}
      secondary={{ label: "Alan adı sorgula", href: "/domain/kayit" }}
    />
  );
}
