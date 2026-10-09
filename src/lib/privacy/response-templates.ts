import type { DataRequestTypeValue } from "./labels";

/**
 * Starting text for the response to a KVKK request (the admin edits it before
 * sending; the mail layout around it is the DB-editable
 * "privacy.request-completed" template). Paragraphs are separated by a blank line.
 */
const COMPLETED: Record<DataRequestTypeValue, string> = {
  INFORMATION: [
    "Başvurunuz üzerine hesabınızla ilişkili kişisel verilerinizin işlendiğini bildiririz.",
    "Verileriniz; hizmet sözleşmesinin kurulması ve ifası, faturalandırma, yasal yükümlülüklerin yerine getirilmesi (VUK, 5651 sayılı Kanun) ve hesap güvenliği amaçlarıyla işlenmektedir. Ödeme kuruluşları, e-fatura entegratörü, alan adı kayıt kuruluşu ve barındırma altyapı sağlayıcılarıyla yalnızca bu amaçlar için gerekli ölçüde paylaşılmaktadır.",
    "Ayrıntılı bilgi için KVKK Aydınlatma Metnimizi inceleyebilirsiniz.",
  ].join("\n\n"),
  EXPORT: [
    "Hakkınızda tuttuğumuz kişisel verilerin bir kopyasını hazırladık.",
    "Dosya, makine tarafından okunabilir bir JSON dosyası ile her bölüm için ayrı CSV tabloları içerir. Güvenliğiniz için bağlantı tek kullanımlıktır.",
  ].join("\n\n"),
  RECTIFICATION: [
    "Başvurunuzda belirttiğiniz kişisel verileriniz düzeltilmiştir.",
    "Düzeltme, verilerinizin aktarıldığı üçüncü kişilere de (varsa) bildirilmiştir.",
  ].join("\n\n"),
  ERASURE: [
    "Başvurunuz üzerine hesabınız kapatılmış ve kişisel verileriniz silinerek anonim hâle getirilmiştir.",
    "213 sayılı Vergi Usul Kanunu gereği faturalarınız ve ödeme kayıtlarınız 10 yıl süreyle saklanmak zorundadır; bu kayıtlarda yalnızca faturada yer alması zorunlu bilgiler tutulmaktadır. Yasal saklama süresi dolduğunda bu kayıtlar da imha edilecektir.",
  ].join("\n\n"),
  OBJECTION: [
    "İtirazınız değerlendirilmiş ve haklı bulunmuştur.",
    "İtiraz konusu işleme faaliyeti durdurulmuştur.",
  ].join("\n\n"),
};

const REJECTED =
  "Başvurunuz incelenmiş, ancak aşağıdaki gerekçeyle reddedilmiştir:\n\n[Gerekçe]\n\nKVKK m.14 uyarınca bu yanıtın tebliğinden itibaren 30 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.";

export function defaultResponseText(type: DataRequestTypeValue, outcome: "COMPLETED" | "REJECTED") {
  return outcome === "REJECTED" ? REJECTED : COMPLETED[type];
}
