import { FaqSection, type FaqItem } from "@/components/site/faq-section";

export const sslFaqs: FaqItem[] = [
  {
    question: "SSL sertifikası nedir?",
    answer:
      "SSL/TLS sertifikası, web siteniz ile ziyaretçileriniz arasındaki bağlantıyı şifreler. Site HTTPS üzerinden açılır ve tarayıcıda kilit simgesi görünür.",
  },
  {
    question: "DV, OV ve EV SSL arasındaki fark nedir?",
    answer:
      "DV (Domain Validation) yalnızca alan adı sahipliğini doğrular ve genellikle dakikalar içinde düzenlenir. OV (Organization Validation) kurum bilgilerini de doğrular. EV (Extended Validation) en kapsamlı doğrulamadır. OV ve EV'de süre, kurum doğrulamasına bağlıdır.",
  },
  {
    question: "Wildcard SSL nedir?",
    answer:
      "Wildcard SSL, ana alan adınızı ve *.alanadi.com biçimindeki tüm alt alan adlarını tek sertifikayla korur (ör. magaza.alanadi.com, blog.alanadi.com).",
  },
  {
    question: "Hosting paketimde ücretsiz SSL var mı?",
    answer:
      "Evet. Hosting paketlerinde Let's Encrypt SSL ücretsizdir. Kurum doğrulaması veya garanti kapsamı gerekiyorsa ücretli sertifika seçebilirsiniz.",
  },
  {
    question: "SSL sertifikası SEO'yu etkiler mi?",
    answer:
      "Google, HTTPS'i sıralama sinyallerinden biri olarak kullanır. Ayrıca SSL olmayan siteler tarayıcılarda 'Güvenli değil' uyarısı gösterir.",
  },
  {
    question: "Sertifikamı başka bir sunucuya taşıyabilir miyim?",
    answer:
      "Evet. Sertifika dosyalarınızı (CRT, özel anahtar, CA paketi) yeni sunucuya yüklemeniz yeterlidir. Taşıma sırasında destek ekibimizden yardım alabilirsiniz.",
  },
  {
    question: "Sertifikanın süresi dolunca ne olur?",
    answer:
      "Süresi dolan sertifika ile site tarayıcılarda güvenlik uyarısı verir. Sertifikanızı süresi dolmadan yenilemeniz gerekir.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer: "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
  },
];

export function SSLFaq() {
  return (
    <FaqSection
      items={sslFaqs}
      description="SSL sertifikaları hakkında merak edilenler."
      tone="muted"
      divider
    />
  );
}
