import { db } from "@/lib/db";
import { getSmsProvider } from "@/lib/integrations/sms";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";

export type SmsNotificationTemplate =
  | "payment_received"
  | "invoice_overdue"
  | "custom";

export interface SendSmsNotificationInput {
  customerId: string;
  message: string;
  template?: SmsNotificationTemplate;
}

const TEMPLATE_MESSAGES: Partial<Record<SmsNotificationTemplate, (data: Record<string, string>) => string>> = {
  payment_received: (data) => `Faturanız ödendi: ${data.invoiceNumber ?? ""}`.trim(),
  invoice_overdue: (data) =>
    `Gecikmiş faturanız: ${data.invoiceNumber ?? ""}. Lütfen ödeme yapın.`.trim(),
};

async function isSmsNotificationsEnabled() {
  const value = await getSettingValue("sms_notifications", undefined, "false");
  return isEnabled(value);
}

async function loadCustomerPhone(customerId: string) {
  const customer = await db.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      phone: true,
    },
  });

  if (!customer?.phone?.trim()) {
    return null;
  }

  return {
    customerId: customer.id,
    phone: customer.phone.trim(),
  };
}

function resolveMessage(input: SendSmsNotificationInput) {
  if (!input.template || input.template === "custom") {
    return input.message;
  }

  const builder = TEMPLATE_MESSAGES[input.template];
  if (!builder) {
    return input.message;
  }

  const invoiceMatch = input.message.match(/F-[\w-]+/);
  return builder({
    invoiceNumber: invoiceMatch?.[0] ?? input.message,
  });
}

export async function sendSmsNotification(input: SendSmsNotificationInput) {
  try {
    if (!(await isSmsNotificationsEnabled())) {
      console.info("[Notifications] SMS atlandı (sms_notifications kapalı)");
      return { sent: false, skipped: true, reason: "SMS_NOTIFICATIONS_DISABLED" };
    }

    const customer = await loadCustomerPhone(input.customerId);
    if (!customer) {
      console.info(
        `[Notifications] SMS atlandı (telefon yok): customer=${input.customerId}`
      );
      return { sent: false, skipped: true, reason: "PHONE_NOT_FOUND" };
    }

    const provider = await getSmsProvider();
    const message = resolveMessage(input);
    const result = await provider.sendSms({
      to: customer.phone,
      message,
    });

    if (!result.sent && result.skipped) {
      console.info(
        `[Notifications] SMS atlandı (${result.error ?? "PROVIDER_DISABLED"}): ${message}`
      );
    } else if (!result.sent) {
      console.error(
        `[Notifications] SMS gönderilemedi (${result.error ?? "UNKNOWN"}): ${message}`
      );
    }

    return result;
  } catch (error) {
    console.error("[Notifications] SMS gönderimi başarısız:", error);
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "SMS_NOTIFICATION_FAILED",
    };
  }
}

export function dispatchSmsNotification(task: () => Promise<unknown>) {
  void task().catch((error) => {
    console.error("[Notifications] SMS gönderimi başarısız:", error);
  });
}