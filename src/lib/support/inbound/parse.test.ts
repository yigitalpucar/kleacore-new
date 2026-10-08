import { describe, expect, it } from "vitest";
import { REPLY_MARKER, ticketMessageIdTag, ticketNumberFromMessageIds, ticketNumberFromSubject, ticketSubjectTag } from "@/lib/support/thread";
import { parseRawEmail } from "./mail";
import { autoReplyReason, cleanSubject, stripQuotedReply } from "./parse";

describe("stripQuotedReply", () => {
  it("cuts English Gmail / Apple quote headers, also when wrapped", () => {
    expect(stripQuotedReply("Teşekkürler, düzeldi.\n\nOn Mon, 6 Oct 2026 at 10:00, KLEACORE <destek@kleacore.com> wrote:\n> Merhaba\n> eski")).toBe(
      "Teşekkürler, düzeldi."
    );
    expect(stripQuotedReply("Thanks!\n\nOn Mon, Oct 6, 2026 at 10:00 AM KLEACORE Destek <destek@kleacore.com>\nwrote:\n\n> old")).toBe("Thanks!");
  });

  it("cuts Turkish Gmail / Outlook quote headers", () => {
    expect(stripQuotedReply("Sorun devam ediyor.\n\n6 Eki 2026 Pzt, 10:00 tarihinde KLEACORE <destek@kleacore.com> şunu yazdı:\n> önceki")).toBe(
      "Sorun devam ediyor."
    );
    expect(stripQuotedReply("Tamam.\n\n6 Ekim 2026 Pazartesi 10:00 tarihinde\nKLEACORE <destek@kleacore.com> şunu yazdı:\n> eski")).toBe("Tamam.");
    expect(
      stripQuotedReply("Ekte gönderdim.\r\n\r\nKimden: KLEACORE Destek <destek@kleacore.com>\r\nGönderildi: 6 Ekim 2026 Pazartesi 10:00\r\nKime: Ayşe\r\nKonu: [#T-123456] Web\r\n\r\nMerhaba")
    ).toBe("Ekte gönderdim.");
  });

  it("cuts Outlook English headers and Original Message separators", () => {
    expect(stripQuotedReply("Done.\n\nFrom: Support <destek@kleacore.com>\nSent: Monday, October 6, 2026 10:00\nTo: Ayse\nSubject: RE: x\n\nold")).toBe("Done.");
    expect(stripQuotedReply("Evet.\n-----Original Message-----\nFrom: x")).toBe("Evet.");
    expect(stripQuotedReply("Evet.\n\n-----Orijinal İleti-----\nKimden: x")).toBe("Evet.");
  });

  it("cuts at our reply-above marker, even when quoted", () => {
    expect(stripQuotedReply(`Yeni bilgi.\n\n> ${REPLY_MARKER}\n> Destek talebiniz yanıtlandı`)).toBe("Yeni bilgi.");
    expect(stripQuotedReply(`Yeni bilgi.\n${REPLY_MARKER}\nDestek talebiniz yanıtlandı`)).toBe("Yeni bilgi.");
  });

  it("drops signatures and mobile footers", () => {
    expect(stripQuotedReply("Merhaba,\nsite açılmıyor.\n\n-- \nAyşe Yılmaz\nACME Ltd.")).toBe("Merhaba,\nsite açılmıyor.");
    expect(stripQuotedReply("Olur.\n\niPhone'umdan gönderildi")).toBe("Olur.");
    expect(stripQuotedReply("Ok.\n\nSent from my iPhone")).toBe("Ok.");
  });

  it("drops a trailing '>' quote block but keeps the text when nothing else remains", () => {
    expect(stripQuotedReply("Yeni satır\n\n> alıntı 1\n> alıntı 2\n")).toBe("Yeni satır");
    expect(stripQuotedReply("> sadece alıntı")).toBe("> sadece alıntı");
  });

  it("keeps ordinary text untouched", () => {
    const text = "Merhaba,\n\nDNS kayıtlarını kontrol eder misiniz?\nTeşekkürler";
    expect(stripQuotedReply(text)).toBe(text);
  });
});

describe("ticket matching helpers", () => {
  it("finds the ticket number in the subject", () => {
    expect(ticketSubjectTag("T-123456")).toBe("[#T-123456]");
    expect(ticketNumberFromSubject("Re: [#T-123456] Destek talebiniz yanıtlandı: Web")).toBe("T-123456");
    expect(ticketNumberFromSubject("YNT: [t-654321] Konu")).toBe("T-654321");
    expect(ticketNumberFromSubject("Talep #T-111222 hakkında")).toBe("T-111222");
    expect(ticketNumberFromSubject("T-123456 yazıyor ama etiket yok")).toBeNull();
    expect(ticketNumberFromSubject("[#T-12] kısa")).toBeNull();
  });

  it("finds the ticket number in our Message-IDs (In-Reply-To / References)", () => {
    expect(ticketMessageIdTag("T-123456")).toBe("ticket.T-123456");
    expect(ticketNumberFromMessageIds(["<abc@gmail.com>", "<ticket.T-123456.9f8e7d6c5b4a3921@kleacore.com>"])).toBe("T-123456");
    expect(ticketNumberFromMessageIds(["<random@kleacore.com>"])).toBeNull();
  });

  it("cleans reply prefixes and ticket tags from new-ticket subjects", () => {
    expect(cleanSubject("Re: Fwd: [#T-123456] Web sitem açılmıyor")).toBe("Web sitem açılmıyor");
    expect(cleanSubject("YNT: İLT: Fatura")).toBe("Fatura");
    expect(cleanSubject("   ")).toBe("");
  });
});

describe("autoReplyReason (loop protection)", () => {
  const base = { from: { address: "ayse@example.com", name: "Ayşe" }, subject: "Soru", contentType: "text/plain", headers: {} };

  it("passes normal mail", () => {
    expect(autoReplyReason(base)).toBeNull();
    expect(autoReplyReason({ ...base, headers: { "auto-submitted": "no" } })).toBeNull();
  });

  it.each([
    [{ headers: { "auto-submitted": "auto-replied" } }, "AUTO_SUBMITTED"],
    [{ headers: { "x-autoreply": "yes" } }, "X_AUTOREPLY"],
    [{ headers: { "x-autorespond": "1" } }, "X_AUTOREPLY"],
    [{ headers: { precedence: "bulk" } }, "PRECEDENCE"],
    [{ headers: { "list-id": "<news.example.com>" } }, "MAILING_LIST"],
    [{ headers: { "return-path": "<>" } }, "BOUNCE"],
    [{ headers: { "x-failed-recipients": "a@b.c" } }, "BOUNCE"],
    [{ contentType: "multipart/report" }, "DELIVERY_REPORT"],
    [{ from: { address: "MAILER-DAEMON@mx.example.com", name: null } }, "SYSTEM_SENDER"],
    [{ from: { address: "no-reply@bank.example", name: null } }, "SYSTEM_SENDER"],
    [{ subject: "Otomatik yanıt: Ofis dışındayım" }, "AUTO_SUBJECT"],
    [{ subject: "Out of Office: Re: [#T-123456]" }, "AUTO_SUBJECT"],
    [{ subject: "Undeliverable: Soru" }, "AUTO_SUBJECT"],
  ])("ignores %j", (patch, reason) => {
    expect(autoReplyReason({ ...base, ...patch })).toBe(reason);
  });
});

describe("parseRawEmail", () => {
  it("normalises headers, references and attachments", async () => {
    const raw = Buffer.from(
      [
        "From: =?UTF-8?Q?Ay=C5=9Fe_Y=C4=B1lmaz?= <Ayse@Example.com>",
        "To: destek@kleacore.com",
        "Subject: =?UTF-8?Q?Re:_[#T-123456]_Destek?=",
        "Message-ID: <reply-1@example.com>",
        "In-Reply-To: <ticket.T-123456.abcd@kleacore.com>",
        "References: <first@example.com> <ticket.T-123456.abcd@kleacore.com>",
        "Auto-Submitted: no",
        "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="b1"',
        "",
        "--b1",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Merhaba",
        "--b1",
        'Content-Type: application/pdf; name="../fatura.pdf"',
        'Content-Disposition: attachment; filename="../fatura.pdf"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from("%PDF-1.4\n").toString("base64"),
        "--b1--",
        "",
      ].join("\r\n")
    );
    const message = await parseRawEmail(raw);
    expect(message.messageId).toBe("<reply-1@example.com>");
    expect(message.from).toEqual({ address: "Ayse@Example.com", name: "Ayşe Yılmaz" });
    expect(message.subject).toBe("Re: [#T-123456] Destek");
    expect(message.inReplyTo).toEqual(["<ticket.T-123456.abcd@kleacore.com>"]);
    expect(message.references).toEqual(["<first@example.com>", "<ticket.T-123456.abcd@kleacore.com>"]);
    expect(message.headers["auto-submitted"]).toBe("no");
    expect(message.text.trim()).toBe("Merhaba");
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toMatchObject({ fileName: "fatura.pdf", related: false });
    expect(message.attachments[0].content.toString()).toBe("%PDF-1.4\n");
  });

  it("turns HTML-only mail into plain text without scripts and gives id-less mail a stable id", async () => {
    const raw = Buffer.from(
      "From: a@example.com\r\nSubject: Soru\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Merhaba <b>dünya</b></p><script>alert(1)</script>"
    );
    const first = await parseRawEmail(raw);
    const second = await parseRawEmail(raw);
    expect(first.text).toBe("Merhaba dünya");
    expect(first.messageId).toMatch(/^<no-id\.[0-9a-f]{40}@inbound\.kleacore>$/);
    expect(second.messageId).toBe(first.messageId);
  });
});
