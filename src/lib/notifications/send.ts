/**
 * STUB (signup agent, Faz 1 dalga B) — the notify agent owns the real
 * notification system (templates, NotificationLog, channels) and replaces this
 * file. The signature is the agreed one:
 *
 *   sendNotification({ userId, template, data, channel? })
 *
 * It enqueues a "notification.send" job; the stub handler below renders the
 * few templates the signup flow needs as a plain e-mail so the flow works
 * end-to-end until the real implementation lands.
 */

export type NotificationChannel = "email" | "sms";

export interface SendNotificationInput {
  userId: string;
  template: string;
  data: Record<string, unknown>;
  channel?: NotificationChannel;
}

export async function sendNotification(input: SendNotificationInput) {
  const { enqueue } = await import("@/lib/jobs/enqueue");
  return enqueue("notification.send", {
    userId: input.userId,
    template: input.template,
    data: input.data,
    channel: input.channel ?? "email",
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Stub handler for the "notification.send" job (see the file comment). */
export async function handleNotificationSendJob(payload: SendNotificationInput) {
  const { db } = await import("@/lib/db");
  const { plainTextToHtml, sendTransactionalEmail } = await import("@/lib/mail");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, name: true },
  });
  if (!user) return { skipped: "user-not-found" };

  if (payload.template === "auth.verify-email") {
    const verifyUrl = text(payload.data.verifyUrl);
    const body = [
      `Merhaba ${user.name},`,
      "",
      "KLEACORE hesabınızı oluşturduğunuz için teşekkürler. E-posta adresinizi doğrulamak için aşağıdaki bağlantıyı açın:",
      verifyUrl,
      "",
      `Bağlantı ${text(payload.data.expiresInHours) || "24"} saat geçerlidir ve yalnızca bir kez kullanılabilir.`,
      "Bu hesabı siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.",
    ].join("\n");
    await sendTransactionalEmail({
      to: user.email,
      subject: "KLEACORE - E-posta adresinizi doğrulayın",
      text: body,
      html: plainTextToHtml(body),
    });
    return { sent: payload.template };
  }

  return { skipped: `template-not-implemented:${payload.template}` };
}
