import type { IntegrationResult } from "../../settings";
import type { SendSmsInput, SendSmsResult, SmsProvider } from "../types";

const NETGSM_SEND_URL = "https://api.netgsm.com.tr/sms/send/xml";
const NETGSM_BALANCE_URL = "https://api.netgsm.com.tr/balance";

export interface NetgsmConfig {
  usercode: string;
  password: string;
  header: string;
}

export function normalizeSmsPhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length === 12 && digits.startsWith("90")) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith("5")) {
    return `90${digits}`;
  }

  if (digits.length >= 10) {
    return digits;
  }

  return null;
}

export function formatSmsMessage(message: string): string {
  return message.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n");
}

export function buildNetgsmXml(input: {
  usercode: string;
  password: string;
  header: string;
  message: string;
  numbers: string[];
}): string {
  const formattedMessage = formatSmsMessage(input.message);
  const numbersXml = input.numbers.map((number) => `<no>${number}</no>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mainbody>` +
    `<header>` +
    `<company>Netgsm</company>` +
    `<usercode>${escapeXml(input.usercode)}</usercode>` +
    `<password>${escapeXml(input.password)}</password>` +
    `<startdate></startdate>` +
    `<stopdate></stopdate>` +
    `<type>1:n</type>` +
    `<msgheader>${escapeXml(input.header)}</msgheader>` +
    `</header>` +
    `<body><msg><![CDATA[${formattedMessage}]]></msg>${numbersXml}</body>` +
    `</mainbody>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseNetgsmSendResponse(text: string): { ok: boolean; reference?: string; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "EMPTY_RESPONSE" };
  }

  const [code, reference] = trimmed.split(/\s+/);
  if (code === "00") {
    return { ok: true, reference };
  }

  if (code === "30") {
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  if (code === "40") {
    return { ok: false, error: "INVALID_HEADER" };
  }

  return { ok: false, error: `NETGSM_ERROR_${code}` };
}

async function postNetgsmXml(url: string, xml: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/xml; charset=UTF-8",
      },
      body: xml,
      signal: controller.signal,
    });

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function createNetgsmSmsProvider(config: NetgsmConfig): SmsProvider {
  return {
    name: "netgsm",
    async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
      const normalizedPhone = normalizeSmsPhoneNumber(input.to);
      if (!normalizedPhone) {
        return {
          sent: false,
          provider: "netgsm",
          error: "INVALID_PHONE",
        };
      }

      try {
        const xml = buildNetgsmXml({
          usercode: config.usercode,
          password: config.password,
          header: config.header,
          message: input.message,
          numbers: [normalizedPhone],
        });

        const responseText = await postNetgsmXml(NETGSM_SEND_URL, xml);
        const parsed = parseNetgsmSendResponse(responseText);

        if (!parsed.ok) {
          return {
            sent: false,
            provider: "netgsm",
            error: parsed.error,
          };
        }

        return {
          sent: true,
          provider: "netgsm",
          reference: parsed.reference,
        };
      } catch (error) {
        return {
          sent: false,
          provider: "netgsm",
          error: error instanceof Error ? error.message : "NETGSM_REQUEST_FAILED",
        };
      }
    },
    async healthCheck(): Promise<IntegrationResult<{ status: string }>> {
      try {
        const response = await fetch(NETGSM_BALANCE_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            usercode: config.usercode,
            password: config.password,
            stip: 1,
          }),
        });

        const payload = (await response.json()) as { code?: string | number; balance?: unknown };

        if (String(payload.code) === "0") {
          return {
            ok: true,
            provider: "netgsm",
            data: { status: "ok" },
          };
        }

        return {
          ok: false,
          provider: "netgsm",
          error: `NETGSM_BALANCE_${payload.code ?? response.status}`,
          data: { status: "error" },
        };
      } catch (error) {
        return {
          ok: false,
          provider: "netgsm",
          error: error instanceof Error ? error.message : "NETGSM_HEALTH_CHECK_FAILED",
          data: { status: "error" },
        };
      }
    },
  };
}