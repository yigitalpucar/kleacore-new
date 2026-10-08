# TCMB kurları, TLD fiyatları ve raporlar (Faz 3.8 / 3.9)

## Kurlar (`src/lib/fx`)
- `fx-rates` cron'u (16:15 ve 18:15, Europe/Istanbul) `https://www.tcmb.gov.tr/kurlar/today.xml`
  bülteninden USD/EUR/GBP için ForexBuying, ForexSelling, BanknoteSelling okur ve
  `exchange_rates` tablosuna (para birimi + bülten tarihi) yazar. Değerler TRY / 1 birim, Decimal(18,6).
- Hafta sonu/tatilde yeni bülten yoktur; today.xml önceki bülteni döndürür, satır değişmez
  (`status: "unchanged"`) ve son kur geçerli kalır.
- `getRate(currency, date)`: tarihin İstanbul gününe ait bülten, yoksa ondan önceki en son bülten
  (varsayılan döviz satış). TRY her zaman 1.
- Geçmiş gün doldurma: `POST /api/cron/fx-rates?date=2026-09-01` (TCMB arşivi; 404 = o gün bülten yok).
- Admin ekranındaki "Kurları güncelle" aynı kilit ve `cron_runs` kaydıyla çalışır, otomatik uygulama yapmaz.

## TLD fiyatları (/yonetim/urunler/tld-fiyatlari)
- `DomainTld.costRegister/costRenew/costTransfer` + `costCurrency` registrar maliyetidir. Gri içe aktarımı
  (Entegrasyonlar › Registrar) artık **yalnızca maliyeti** yazar; satış fiyatına dokunmaz, ilk kez görülen
  uzantıyı satışa kapalı ve fiyatsız oluşturur. Maliyet satır menüsünden elle de girilebilir.
- Öneri = maliyet × döviz satış kuru × (1 + marj %) + sabit marj ₺, seçilen bitişe (,90 / ,99 / tam lira /
  kuruş) **yukarı** yuvarlanır. Fiyatlar KDV hariçtir.
- "Önerileri uygula" onay penceresi değişecek fiyatları listeler; öneriler sunucuda yeniden hesaplanır,
  bu arada yeni bülten geldiyse işlem reddedilir. Her uygulama `activity_logs`'a
  (`tld.prices.applied`, önce/sonra fiyatlar, kur, kural) yazılır.
- "Her gün otomatik uygula" varsayılan **kapalıdır**. Açılırsa kur senkronundan sonra çalışır, kaydı kuralı
  açan yöneticinin adına `tld.prices.auto_applied` olarak düşer ve %30'dan büyük değişimleri atlar.

## Raporlar (/yonetim/raporlar)
Sekmeler URL'dedir (`?tab=`), yalnızca açık sekmenin verisi yüklenir. Dönem: hazır aralık (`period`) veya
`from`/`to` (İstanbul günleri). Her tablonun CSV'si: `/api/admin/reports/csv?table=<anahtar>&…`
(UTF-8 BOM, `;` ayraç, ondalık virgül — Türkçe Excel; formül enjeksiyonuna karşı metinler `'` ile korunur).

- **MRR & churn** (`mrr.ts`): `Service.amount` dönem toplamıdır; aylık karşılık = tutar ÷ dönem ayı
  (period-price ile aynı). Geçmiş, zaman damgalarından türetilir: başlangıç `createdAt`, bitiş
  `cancelledAt` / iptal-süresi dolmuşta `updatedAt` / askıdaysa `suspendedAt`. PENDING ve 0 ₺ hizmetler,
  alan adları dahil değildir; paket değişimi sürümlenmediği için genişleme/daralma MRR'ı yoktur.
- **Gelir**: kategoriye (sipariş → ürün → kategori; domain yenileme → Alan adı) ve ödeme yöntemine göre.
- **Tahsilat**: günlük (≤62 gün) / aylık tahsilat, iadeler; alacak yaşlandırma bugünün anlık görüntüsüdür.
- **KDV**: satışlar ödeme ayında (sonradan iade edilse de), tamamlanan iadeler iade ayında
  KDV dahil tutardan ayrıştırılarak düşülür. Mutabakat: e-belgesi (SENT/ACCEPTED) olmayan ödenmiş faturalar
  ve `ublPayload` toplamı/KDV'si faturadan farklı belgeler.
- **Domain kârı**: net satış − (güncel TLD maliyeti × yıl × ödeme günündeki kur). Maliyet geçmişi
  tutulmadığından eski satışlar yaklaşık hesaplanır.
