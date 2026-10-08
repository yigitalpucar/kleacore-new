import { FaqSection, type FaqItem } from "@/components/site/faq-section";

export const serverFaqs: FaqItem[] = [
  {
    question: "VPS, VDS ve bulut sunucu arasındaki fark nedir?",
    answer:
      "Üçü de sanal sunucudur. VDS paketlerinde kaynaklar size ayrılmış olarak tanımlanır; VPS paketleri daha ekonomik giriş seviyesi seçeneklerdir; bulut sunucu paketleri ise daha yüksek kaynak ve port seçenekleri sunar. Paketlerin işlemci, bellek ve disk değerleri ürün sayfalarında yazar.",
  },
  {
    question: "Fiziksel sunucu ne zaman tercih edilmeli?",
    answer:
      "Yoğun veritabanı, yüksek işlem gücü veya donanımın tamamen size ayrılmasını gerektiren projelerde fiziksel (dedicated) sunucu uygundur.",
  },
  {
    question: "Root erişimim olacak mı?",
    answer:
      "Evet. Sunucu paketlerinde tam root/yönetici erişimi verilir; istediğiniz yazılımı kurup yapılandırabilirsiniz.",
  },
  {
    question: "Sunucular nerede barındırılıyor?",
    answer: "Sunucularımız İstanbul lokasyonunda barındırılır.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer:
      "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
  },
  {
    question: "Aylık mı, yıllık mı ödeme yapabilirim?",
    answer:
      "İkisi de mümkün. Yıllık ödemede aylık karşılık daha düşüktür; fark paket kartlarında gösterilir.",
  },
  {
    question: "Paketimi daha sonra değiştirebilir miyim?",
    answer:
      "Evet. Müşteri panelinden paket değişikliği talebi oluşturabilirsiniz; talebiniz ekibimiz tarafından değerlendirilir.",
  },
  {
    question: "Teknik destek nasıl alırım?",
    answer:
      "Müşteri panelinden 7/24 destek talebi açabilir veya support@kleacore.com adresine e-posta gönderebilirsiniz.",
  },
];

export function ServerFaq() {
  return (
    <FaqSection
      items={serverFaqs}
      description="Sunucu hizmetlerimiz hakkında merak edilenler."
      divider
    />
  );
}
