import type { IntegrationResult } from "../../settings";
import type { SendSmsInput, SendSmsResult, SmsProvider } from "../types";
import { normalizeSmsPhoneNumber } from "./netgsm";

const ILETIMERKEZI_BASE_URL = "https://api.iletimerkezi.com/v1";

export interface IletiMerkeziConfig {
  apiKey: string;
  secret: string;
  sender: string;
}

interface IletiMerkeziResponse {
  response?: {
    status?: {
      code?: number;
      message?: string;
    };
    order?: {
      id?: string;
    };
    balance?: {
      amount?: number;
      sms?: number;
    };
  };
}

async function postIletiMerkeziJson<T extends IletiMerkeziResponse>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${ILETIMERKEZI_BASE_URL}/${endpoint}/json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function createIletiMerkeziSmsProvider(config: IletiMerkeziConfig): SmsProvider {
  return {
    name: "iletimerkezi",
    async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
      const normalizedPhone = normalizeSmsPhoneNumber(input.to);
      if (!normalizedPhone) {
        return {
          sent: false,
          provider: "iletimerkezi",
          error: "INVALID_PHONE",
        };
      }

      try {
        const payload = {
          request: {
            authentication: {
              key: config.apiKey,
              hash: config.secret,
            },
            order: {
              sender: config.sender,
              iys: "0",
              message: {
                text: input.message,
                receipents: {
                  number: [normalizedPhone],
                },
              },
            },
          },
        };

        const response = await postIletiMerkeziJson<IletiMerkeziResponse>("send-sms", payload);
        const statusCode = response.response?.status?.code;

        if (statusCode === 200) {
          return {
            sent: true,
            provider: "iletimerkezi",
            reference: response.response?.order?.id,
          };
        }

        return {
          sent: false,
          provider: "iletimerkezi",
          error: response.response?.status?.message ?? `ILETIMERKEZI_ERROR_${statusCode ?? "UNKNOWN"}`,
        };
      } catch (error) {
        return {
          sent: false,
          provider: "iletimerkezi",
          error: error instanceof Error ? error.message : "ILETIMERKEZI_REQUEST_FAILED",
        };
      }
    },
    async healthCheck(): Promise<IntegrationResult<{ status: string }>> {
      try {
        const payload = {
          request: {
            authentication: {
              key: config.apiKey,
              hash: config.secret,
            },
          },
        };

        const response = await postIletiMerkeziJson<IletiMerkeziResponse>("get-balance", payload);
        const statusCode = response.response?.status?.code;

        if (statusCode === 200) {
          return {
            ok: true,
            provider: "iletimerkezi",
            data: { status: "ok" },
          };
        }

        return {
          ok: false,
          provider: "iletimerkezi",
          error: response.response?.status?.message ?? `ILETIMERKEZI_BALANCE_${statusCode ?? "UNKNOWN"}`,
          data: { status: "error" },
        };
      } catch (error) {
        return {
          ok: false,
          provider: "iletimerkezi",
          error: error instanceof Error ? error.message : "ILETIMERKEZI_HEALTH_CHECK_FAILED",
          data: { status: "error" },
        };
      }
    },
  };
}