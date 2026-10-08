# E-posta ile destek talebi (IMAP) ve destek kolaylıkları

## Akış

`support-mail` cron'u (2 dakikada bir, `scripts/setup-dokploy-schedules.mjs`)
etkin her `SupportMailbox` için IMAP'e bağlanır, klasördeki **okunmamış**
iletileri (en çok 50) `BODY.PEEK` ile indirir ve `src/lib/support/inbound/`
ile işler:

1. **Tekilleştirme:** `inbound_emails.messageId` benzersiz. İşlenmiş /
   yok sayılmış bir Message-ID tekrar gelirse yalnızca okundu işaretlenir.
   Message-ID'siz iletiye ham içeriğin hash'iyle sabit kimlik verilir.
2. **Döngü koruması (yok sayılır):** `Auto-Submitted` (≠ `no`), `X-Autoreply`
   / `X-Autorespond`, `Precedence: bulk|junk|list|auto_reply`, `List-Id`,
   `Return-Path: <>`, `X-Failed-Recipients`, `multipart/report`,
   MAILER-DAEMON / postmaster / no-reply göndericiler, "Otomatik yanıt / Out
   of office / Undeliverable" konuları, kendi adreslerimiz (posta kutuları,
   `company_email`, `support_email`, `SMTP_FROM`) ve saatte 20'den fazla
   ileti gönderen adres.
3. **Müşteri eşleme:** `From` adresi, e-postası **doğrulanmış** bir
   `CUSTOMER` hesabıyla (büyük/küçük harf duyarsız) eşleşirse talep o
   müşteriye açılır. Eşleşmezse talep **kayıtsız gönderen** olarak
   (`customerId = null`, `guestEmail`) açılır; listede "Kayıtsız" etiketiyle
   görünür, talep ekranındaki "Müşteriye bağla" ile bir hesaba bağlanabilir.
4. **Talep eşleme:** konudaki `[#T-123456]` (ya da `#T-123456`), yoksa
   `In-Reply-To` / `References` içindeki kendi Message-ID'lerimiz
   (`<ticket.T-123456.<rastgele>@alan>`) ya da daha önce işlenmiş bir gelen
   iletinin Message-ID'si. Eşleşme yalnızca gönderen talebin sahibiyse
   geçerlidir; başkası talep numarasını yazarsa ayrı bir talep açılır.
   Kapalı talebe gelen yanıt talebi yeniden açar (`CUSTOMER_REPLY`).
5. **Metin:** HTML-only ileti mailparser ile düz metne çevrilir (script /
   style atılır) ve yalnızca düz metin saklanır. Alıntı ve imza temizlenir:
   bizim "##- Yanıtınızı bu satırın üstüne yazın -##" işaretimiz,
   "On … wrote:", "… tarihinde … şunu yazdı:", Outlook
   Kimden/From + Gönderildi/Sent + Kime/To blokları, "-----Original
   Message-----", `-- ` imza ayracı, "iPhone'umdan gönderildi" vb.
6. **Ekler:** web formuyla aynı doğrulama (`docs/ops-storage.md`); HTML'e
   gömülü (cid) imza görselleri alınmaz, reddedilen ekler mesajın sonuna
   "Kabul edilmeyen ekler: …" olarak yazılır.
7. Talep / yanıt, ekler ve `inbound_emails` satırı **tek transaction'da**
   yazılır. Ardından ileti `\Seen` işaretlenir ve "İşlenenleri taşı" klasörü
   tanımlıysa oraya taşınır (yoksa oluşturulur). İşleme hata verirse ileti
   okunmamış kalır ve sonraki turlarda en çok 3 kez denenir, sonra `FAILED`
   olarak bırakılır.
8. Yeni talepte gönderene "Destek talebiniz alındı" e-postası
   (`support.ticket-received`) gider; konu `[#T-…]` içerir, Reply-To destek
   adresidir, böylece müşterinin yanıtı aynı talebe düşer.

Giden talep e-postaları (`support.ticket-replied`, `…-received`,
`…-auto-close-warning`) konuya `[#T-…]`, en üste yanıt işaretini, `Reply-To`
olarak posta kutusu adresini ve `Message-ID` olarak
`<ticket.T-….<rastgele>@gönderen-alanı>` ekler.

## Kurulum (sahip)

1. cPanel'de `destek@kleacore.com` hesabı (yoksa) oluşturun.
2. `/yonetim/destek/ayarlar` → **Posta kutusu ekle**: destek adresi, IMAP
   sunucusu (ör. `mail.kleacore.com`), 993 / TLS, kullanıcı adı (tam e-posta),
   parola (veritabanında `enc:v1:` ile şifreli), klasör `INBOX`, isteğe bağlı
   "İşlenenleri taşı" (ör. `INBOX.Islenen`), departman.
3. **Bağlantıyı test et** (yalnızca giriş + klasör açar, hiçbir şeyi
   değiştirmez) → **Şimdi oku**.
4. Dokploy zamanlamalarını güncelleyin: `pnpm ops:cron:setup` (yeni
   `support-mail` ve `support-autoclose` görevleri).
5. Kabul: destek@'e bir test e-postası gönderin; en geç ~2 dk içinde talep
   olarak görünmeli. Yanıtlayın; müşterinin e-postayla yanıtı aynı talebe
   eklenmeli.

Gelen tüm iletiler ve ne yapıldığı (işlendi / yok sayıldı + neden / hata)
aynı ekranın "Son gelen e-postalar" bölümünde görünür.

## Destek kolaylıkları

- **Hazır yanıtlar** (`/yonetim/destek/hazir-yanitlar`): başlık, metin,
  isteğe bağlı departman. Değişkenler: `{{customer.name}}`,
  `{{customer.firstName}}`, `{{customer.email}}`, `{{ticket.number}}`,
  `{{ticket.subject}}`, `{{staff.name}}`. Talep ekranında "Hazır yanıt ekle"
  ile yanıt kutusuna doldurulur (gönderilmeden önce düzenlenebilir);
  kullanım sayısı sıralamada kullanılır.
- **Müşteri yanıtı bekleniyor:** personel yanıtı "Yanıtlandı"
  (`ADMIN_REPLY`), "Müşteri yanıtı bekleniyor" (`WAITING`) ya da "Yanıtla ve
  kapat" ile gönderebilir; başlıktaki düğmeyle yanıt yazmadan da `WAITING`'e
  alınabilir. Müşteri panelinde `WAITING` "Yanıtınız bekleniyor" görünür.
- **Otomatik kapatma** (`support-autoclose`, saatlik; ayar
  `support_auto_close_days`, varsayılan 5, 0 = kapalı): `ADMIN_REPLY` /
  `WAITING` talepte saat `waitingSince` ile başlar (müşteri yanıtında
  sıfırlanır). Gün-1'de bir kez uyarı e-postası
  (`support.ticket-auto-close-warning`, idempotency anahtarı dönem başına),
  süre dolunca ve uyarıdan en az 24 saat sonra talep kapatılır ve "Sistem"
  mesajı eklenir. Koşullu güncelleme ile talep "sahiplenildiği" için üst üste
  çalışma iki kez uyarmaz / kapatmaz. Göç anında yanıtlanmış durumdaki
  talepler için saat göç zamanından başlar.

## Test

- Birim: `pnpm test` (MIME, yol geçişi, indirme yetkisi, alıntı temizleme,
  eşleme, döngü koruması, tekilleştirme, otomatik kapatma).
- Uçtan uca (GreenMail + yerel Postgres): bkz.
  `src/lib/support/inbound/imap.integration.test.ts` başlığındaki komut.
