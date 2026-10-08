import { describe, expect, it } from "vitest";
import {
  buildAuthenticationResponseHash,
  buildPaymentHash,
  buildPaymentRequestXml,
  buildProvisionHash,
  buildProvisionRequestXml,
  buildReversalSoapEnvelope,
  createMerchantOrderId,
  decodeAuthenticationResponseField,
  detectCardType,
  hashKuveytTurkPassword,
  mapKuveytTurkCurrency,
  parseAuthenticationResponse,
  parseProvisionResponse,
  parseReversalResponse,
  readXmlValue,
  sha1Base64,
  toKurus,
  toTurkishBankMessage,
  verifyAuthenticationResponseHash,
} from "./kuveytturk-protocol";

// Public Kuveyt Türk test merchant (see docs/payments-kuveytturk.md).
const credentials = {
  merchantId: "496",
  customerId: "400235",
  username: "apitest",
  password: "api123",
};
const callbackUrl = "https://kleacore.com/api/payments/kuveytturk/callback";

// Expected values computed independently with Python hashlib (sha1 → base64).
describe("Kuveyt Türk hashes", () => {
  it("hashes the password as base64(sha1(password))", () => {
    expect(hashKuveytTurkPassword("api123")).toBe("poCqMathhevCYY1LVNbWCQWbC5I=");
  });

  it("builds the ThreeDModelPayGate HashData with OkUrl and FailUrl", () => {
    expect(
      buildPaymentHash(credentials, {
        merchantOrderId: "KCTEST0001",
        amountKurus: 12050,
        okUrl: callbackUrl,
        failUrl: callbackUrl,
      })
    ).toBe("OI3nfC7VlNs6WwZwMTtU3o8Oq+Y=");
  });

  it("builds the provision / iptal / iade HashData without URLs", () => {
    expect(buildProvisionHash(credentials, { merchantOrderId: "KCTEST0001", amountKurus: 12050 })).toBe(
      "wVxO2ndAt2HFC2doIJw2U7l8kFo="
    );
  });

  it("hashes ISO-8859-9 bytes so Turkish characters match the bank", () => {
    expect(sha1Base64("şifreĞİı")).toBe("ea8fcqO7W3+tAqP/IbkwB+esQLE=");
  });

  it("matches a real bank AuthenticationResponse HashData (MerchantOrderId+ResponseCode+OrderId+HashedPassword)", () => {
    // Response captured from the bank (mewebstudio/pos fixture); the bank
    // echoes HashPassword = base64(sha1(password)) in VPosMessage.
    expect(sha1Base64("MP-15" + "00" + "86483278" + "Hiorgg24rNeRdHUvMCg//mOJn4U=")).toBe(
      "mOw0JGvy1JVWqDDmFyaDTvKz9Fk="
    );
    expect(
      buildAuthenticationResponseHash("api123", {
        merchantOrderId: "KCTEST0001",
        responseCode: "00",
        orderId: "123456",
      })
    ).toBe("QXwpr0HHRf9ButJeNMNUFZikBB8=");
  });
});

describe("Kuveyt Türk helpers", () => {
  it("converts TL to integer kuruş without float noise", () => {
    expect(toKurus(102.65)).toBe(10265);
    expect(toKurus(0.1 + 0.2)).toBe(30);
    expect(toKurus(1)).toBe(100);
  });

  it("creates unique alphanumeric MerchantOrderIds of 20 chars", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createMerchantOrderId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^KC[A-Z0-9]{18}$/);
  });

  it("detects card brands", () => {
    expect(detectCardType("4508034508034509")).toBe("Visa");
    expect(detectCardType("5188961939192544")).toBe("MasterCard");
    expect(detectCardType("9792030000000000")).toBe("Troy");
  });

  it("maps the bank currency code", () => {
    expect(mapKuveytTurkCurrency("0949")).toBe("TRY");
    expect(mapKuveytTurkCurrency("949")).toBe("TRY");
    expect(mapKuveytTurkCurrency("0840")).toBe("0840");
  });
});

describe("buildPaymentRequestXml", () => {
  const xml = buildPaymentRequestXml(credentials, {
    merchantOrderId: "KCTEST0001",
    amountKurus: 12050,
    okUrl: callbackUrl,
    failUrl: callbackUrl,
    clientIp: "203.0.113.7",
    card: {
      holderName: "Ayşe <Yılmaz>",
      number: "5188961939192544",
      expireMonth: "06",
      expireYear: "29",
      cvv: "588",
    },
    cardHolder: { email: "a@b.com", phone: "+90 532 111 22 33", city: "Ankara", address: "Kızılay & Çankaya" },
  });

  it("is a KuveytTurkVPosMessage with the 3-D sale fields", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><KuveytTurkVPosMessage')).toBe(true);
    expect(readXmlValue(xml, "APIVersion")).toBe("TDV2.0.0");
    expect(readXmlValue(xml, "MerchantId")).toBe("496");
    expect(readXmlValue(xml, "CustomerId")).toBe("400235");
    expect(readXmlValue(xml, "UserName")).toBe("apitest");
    expect(readXmlValue(xml, "TransactionType")).toBe("Sale");
    expect(readXmlValue(xml, "TransactionSecurity")).toBe("3");
    expect(readXmlValue(xml, "InstallmentCount")).toBe("0");
    expect(readXmlValue(xml, "Amount")).toBe("12050");
    expect(readXmlValue(xml, "DisplayAmount")).toBe("12050");
    expect(readXmlValue(xml, "CurrencyCode")).toBe("0949");
    expect(readXmlValue(xml, "OkUrl")).toBe(callbackUrl);
    expect(readXmlValue(xml, "HashData")).toBe("OI3nfC7VlNs6WwZwMTtU3o8Oq+Y=");
    expect(readXmlValue(xml, "CardType")).toBe("MasterCard");
    expect(readXmlValue(xml, "DeviceData/ClientIP")).toBe("203.0.113.7");
    expect(readXmlValue(xml, "DeviceData/DeviceChannel")).toBe("02");
    expect(readXmlValue(xml, "CardHolderData/MobilePhone/Subscriber")).toBe("5321112233");
    expect(readXmlValue(xml, "CardHolderData/BillAddrCountry")).toBe("792");
  });

  it("escapes user-provided text", () => {
    expect(xml).toContain("<CardHolderName>Ayşe &lt;Yılmaz&gt;</CardHolderName>");
    expect(xml).toContain("<BillAddrLine1>Kızılay &amp; Çankaya</BillAddrLine1>");
    expect(readXmlValue(xml, "CardHolderName")).toBe("Ayşe <Yılmaz>");
  });
});

describe("parseAuthenticationResponse", () => {
  // Real bank response (URL-encoded as posted to OkUrl), from mewebstudio/pos.
  const successXml =
    '<?xml version="1.0"?>\n<VPosTransaction xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><VPosMessage><OrderId>86483278</OrderId><OkUrl>https://www.example.com/testodeme</OkUrl><MerchantId>48544</MerchantId><HashPassword>Hiorgg24rNeRdHUvMCg//mOJn4U=</HashPassword><CardNumber>5124********1609</CardNumber><InstallmentCount>0</InstallmentCount><Amount>10</Amount><MerchantOrderId>MP-15</MerchantOrderId><CurrencyCode>949</CurrencyCode><TransactionSecurity>3</TransactionSecurity><DeferringCount xsi:nil="true"></DeferringCount></VPosMessage><IsEnrolled>true</IsEnrolled><ResponseCode>00</ResponseCode><ResponseMessage>Kart do&#x11F;ruland&#x131;.</ResponseMessage><OrderId>86483278</OrderId><MerchantOrderId>MP-15</MerchantOrderId><HashData>mOw0JGvy1JVWqDDmFyaDTvKz9Fk=</HashData><MD>ktSVkYJHcHSYM1ibA/nM6nObr8WpWdcw34ziyRQRLv06g7UR2r5LrpLeNvwfBwPz</MD><BusinessKey>202208456498416947</BusinessKey></VPosTransaction>';

  it("decodes the URL-encoded form field and reads the top-level fields", () => {
    const field = new URLSearchParams({ AuthenticationResponse: encodeURIComponent(successXml) }).get(
      "AuthenticationResponse"
    )!;
    const response = parseAuthenticationResponse(decodeAuthenticationResponseField(field));
    expect(response).toEqual({
      responseCode: "00",
      responseMessage: "Kart doğrulandı.",
      merchantOrderId: "MP-15",
      orderId: "86483278",
      hashData: "mOw0JGvy1JVWqDDmFyaDTvKz9Fk=",
      md: "ktSVkYJHcHSYM1ibA/nM6nObr8WpWdcw34ziyRQRLv06g7UR2r5LrpLeNvwfBwPz",
      amountKurus: 10,
      currencyCode: "949",
      installmentCount: "0",
    });
  });

  it("reads an error response without VPosMessage or HashData", () => {
    const response = parseAuthenticationResponse(
      '<?xml version="1.0"?><VPosTransaction><IsEnrolled>true</IsEnrolled><ResponseCode>HashDataError</ResponseCode><ResponseMessage>&#x15E;ifrelenen veriler (Hashdata) uyu&#x15F;mamaktad&#x131;r.</ResponseMessage><OrderId>0</OrderId><MerchantOrderId>2020110828BC</MerchantOrderId></VPosTransaction>'
    );
    expect(response).toMatchObject({
      responseCode: "HashDataError",
      responseMessage: "Şifrelenen veriler (Hashdata) uyuşmamaktadır.",
      merchantOrderId: "2020110828BC",
      hashData: undefined,
      amountKurus: undefined,
    });
  });

  it("rejects unrelated documents", () => {
    expect(parseAuthenticationResponse("<html></html>")).toBeNull();
  });

  it("verifies HashData and rejects a tampered response", () => {
    const hashData = buildAuthenticationResponseHash("api123", {
      merchantOrderId: "KC1",
      responseCode: "00",
      orderId: "999",
    });
    const base = { responseCode: "00", responseMessage: "", merchantOrderId: "KC1", orderId: "999", hashData };
    expect(verifyAuthenticationResponseHash("api123", base)).toBe(true);
    expect(verifyAuthenticationResponseHash("api123", { ...base, orderId: "1000" })).toBe(false);
    expect(verifyAuthenticationResponseHash("wrong", base)).toBe(false);
    expect(verifyAuthenticationResponseHash("api123", { ...base, hashData: undefined })).toBe(false);
  });
});

describe("provision", () => {
  it("builds the ThreeDModelProvisionGate message with the MD", () => {
    const xml = buildProvisionRequestXml(credentials, {
      merchantOrderId: "KCTEST0001",
      amountKurus: 12050,
      md: "md+/value==",
    });
    expect(readXmlValue(xml, "HashData")).toBe("wVxO2ndAt2HFC2doIJw2U7l8kFo=");
    expect(readXmlValue(xml, "KuveytTurkVPosAdditionalData/AdditionalData/Key")).toBe("MD");
    expect(readXmlValue(xml, "KuveytTurkVPosAdditionalData/AdditionalData/Data")).toBe("md+/value==");
    expect(readXmlValue(xml, "Amount")).toBe("12050");
    expect(readXmlValue(xml, "MerchantOrderId")).toBe("KCTEST0001");
    expect(xml).not.toContain("OkUrl");
  });

  it("parses the provision response and keeps only the card's last four digits", () => {
    const response = parseProvisionResponse(
      '<?xml version="1.0" encoding="utf-8"?><VPosTransactionResponseContract><VPosMessage><OrderId>4480</OrderId><CardNumber>5124********1609</CardNumber><Amount>100</Amount><MerchantOrderId>660723214</MerchantOrderId><CurrencyCode>949</CurrencyCode></VPosMessage><IsEnrolled>true</IsEnrolled><ProvisionNumber>896626</ProvisionNumber><RRN>904115005554</RRN><Stan>005554</Stan><ResponseCode>00</ResponseCode><ResponseMessage>OTORİZASYON VERİLDİ</ResponseMessage><OrderId>4480</OrderId><MerchantOrderId>660723214</MerchantOrderId><HashData>I7H/6nwfydM6VcwXsl82mqeC83o=</HashData></VPosTransactionResponseContract>'
    );
    expect(response).toEqual({
      responseCode: "00",
      responseMessage: "OTORİZASYON VERİLDİ",
      merchantOrderId: "660723214",
      orderId: "4480",
      provisionNumber: "896626",
      rrn: "904115005554",
      stan: "005554",
      amountKurus: 100,
      currencyCode: "949",
      cardLast4: "1609",
      hashData: "I7H/6nwfydM6VcwXsl82mqeC83o=",
    });
  });
});

describe("iptal / iade SOAP", () => {
  const reference = {
    merchantOrderId: "KCTEST0001",
    orderId: "114293600",
    rrn: "318923298433",
    stan: "298433",
    provisionNumber: "241839",
    amountKurus: 12050,
  };

  it("builds a SaleReversal (iptal) envelope", () => {
    const { soapAction, body } = buildReversalSoapEnvelope(credentials, {
      ...reference,
      operation: "SaleReversal",
    });
    expect(soapAction).toBe(
      "http://boa.net/BOA.Integration.VirtualPos/Service/IVirtualPosService/SaleReversal"
    );
    expect(body.startsWith(
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://boa.net/BOA.Integration.VirtualPos/Service"><soapenv:Body><ser:SaleReversal><ser:request><ser:IsFromExternalNetwork>true</ser:IsFromExternalNetwork><ser:BusinessKey>0</ser:BusinessKey>'
    )).toBe(true);
    expect(body).toContain("<ser:OrderId>114293600</ser:OrderId><ser:RRN>318923298433</ser:RRN><ser:Stan>298433</ser:Stan><ser:ProvisionNumber>241839</ser:ProvisionNumber>");
    expect(readXmlValue(body, "VPosMessage/TransactionType")).toBe("SaleReversal");
    expect(readXmlValue(body, "VPosMessage/HashData")).toBe("wVxO2ndAt2HFC2doIJw2U7l8kFo=");
    expect(readXmlValue(body, "VPosMessage/CancelAmount")).toBe("12050");
    expect(readXmlValue(body, "VPosMessage/DisplayAmount")).toBe("12050");
    expect(readXmlValue(body, "VPosMessage/TransactionSecurity")).toBe("1");
    expect(body.endsWith("</ser:request></ser:SaleReversal></soapenv:Body></soapenv:Envelope>")).toBe(true);
  });

  it("builds DrawBack (full iade) and PartialDrawback (kısmi iade) envelopes", () => {
    const full = buildReversalSoapEnvelope(credentials, { ...reference, operation: "DrawBack" });
    expect(full.soapAction.endsWith("/DrawBack")).toBe(true);
    expect(full.body).toContain("<ser:DrawBack><ser:request>");
    expect(readXmlValue(full.body, "VPosMessage/DisplayAmount")).toBe("0");

    const partial = buildReversalSoapEnvelope(credentials, {
      ...reference,
      amountKurus: 5000,
      operation: "PartialDrawback",
    });
    expect(partial.body).toContain("<ser:PartialDrawback><ser:request>");
    expect(readXmlValue(partial.body, "VPosMessage/CancelAmount")).toBe("5000");
    expect(readXmlValue(partial.body, "VPosMessage/HashData")).toBe(
      buildProvisionHash(credentials, { merchantOrderId: "KCTEST0001", amountKurus: 5000 })
    );
  });

  it("parses approved, declined and fault responses", () => {
    const approved = parseReversalResponse(
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><SaleReversalResponse xmlns="http://boa.net/BOA.Integration.VirtualPos/Service"><SaleReversalResult xmlns:a="http://schemas.datacontract.org/2004/07/BOA.Integration.Base"><a:Results/><a:Success>true</a:Success><a:Value><a:ProvisionNumber>241839</a:ProvisionNumber><a:RRN>318923298433</a:RRN><a:Stan>298433</a:Stan><a:ResponseCode>00</a:ResponseCode><a:ResponseMessage>OTORİZASYON VERİLDİ</a:ResponseMessage><a:OrderId>114293600</a:OrderId></a:Value></SaleReversalResult></SaleReversalResponse></s:Body></s:Envelope>',
      "SaleReversal"
    );
    expect(approved).toMatchObject({ ok: true, responseCode: "00", provisionNumber: "241839", rrn: "318923298433" });

    const declined = parseReversalResponse(
      '<s:Envelope><s:Body><DrawBackResponse><DrawBackResult><Results><Result><ErrorCode>MB_1</ErrorCode><ErrorMessage>İşlem daha önce iade edilmiştir.</ErrorMessage></Result></Results><Success>false</Success><Value><ResponseCode>28</ResponseCode></Value></DrawBackResult></DrawBackResponse></s:Body></s:Envelope>',
      "DrawBack"
    );
    expect(declined).toMatchObject({ ok: false, responseCode: "28", message: "İşlem daha önce iade edilmiştir." });

    const fault = parseReversalResponse(
      '<s:Envelope><s:Body><s:Fault><faultcode>a:InternalServiceFault</faultcode><faultstring xml:lang="tr-TR">Hata</faultstring></s:Fault></s:Body></s:Envelope>',
      "SaleReversal"
    );
    expect(fault).toEqual({ ok: false, responseCode: "SOAP_FAULT", message: "Hata" });
  });
});

describe("toTurkishBankMessage", () => {
  it("keeps the bank's Turkish sentences and translates bare tokens", () => {
    expect(toTurkishBankMessage("51", "Bakiye yetersiz.")).toBe("Bakiye yetersiz.");
    // Observed in the test environment when the 3-D page is cancelled.
    expect(toTurkishBankMessage("888", "NOT_AUTHENTICATED")).toBe(
      "3D Secure doğrulaması tamamlanmadı veya iptal edildi."
    );
    expect(toTurkishBankMessage("HashDataError", "")).toBe("İşlem güvenlik doğrulamasından geçemedi.");
    expect(toTurkishBankMessage("X9", "")).toBe("Ödeme bankanız tarafından onaylanmadı (kod X9).");
  });
});
