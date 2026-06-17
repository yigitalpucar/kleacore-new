import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/mail";
import { dispatchSmsNotification, sendSmsNotification } from "@/lib/notifications/sms";
import type { CronJobResult } from "./types";

const WARNING_DAYS = 30;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR").format(date);
}

async function notifySslExpiry(input: {
  customerId: string;
  email: string;
  fullName: string;
  domain: string;
  expiresAt: Date;
  expired: boolean;
}) {
  const subject = input.expired
    ? `SSL Sertifikanızın Süresi Doldu: ${input.domain}`
    : `SSL Sertifikanız Yakında Sona Eriyor: ${input.domain}`;

  const text = input.expired
    ? `Merhaba ${input.fullName},\n\n${input.domain} alan adı için SSL sertifikanızın süresi ${formatDate(input.expiresAt)} tarihinde doldu. Lütfen yenileme işlemini başlatın.`
    : `Merhaba ${input.fullName},\n\n${input.domain} alan adı için SSL sertifikanız ${formatDate(input.expiresAt)} tarihinde sona erecek. Lütfen yenileme işlemini planlayın.`;

  await sendTransactionalEmail({
    to: input.email,
    subject,
    text,
    html: `<p>${text.replace(/\n/g, "<br />")}</p>`,
  });

  dispatchSmsNotification(() =>
    sendSmsNotification({
      customerId: input.customerId,
      message: input.expired
        ? `SSL sertifikanızın süresi doldu: ${input.domain}`
        : `SSL sertifikanız yakında sona eriyor: ${input.domain} (${formatDate(input.expiresAt)})`,
      template: "custom",
    })
  );
}

export async function checkSslExpiry(): Promise<CronJobResult> {
  const now = new Date();
  const warningThreshold = addDays(now, WARNING_DAYS);
  const processedIds: string[] = [];

  const expired = await db.sslCertificate.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  if (expired.length > 0) {
    await db.sslCertificate.updateMany({
      where: { id: { in: expired.map((cert) => cert.id) } },
      data: { status: "EXPIRED" },
    });

    for (const cert of expired) {
      processedIds.push(cert.id);
      const fullName = `${cert.customer.name ?? ""} ${cert.customer.surname ?? ""}`.trim();
      await notifySslExpiry({
        customerId: cert.customer.id,
        email: cert.customer.email,
        fullName: fullName || "Müşteri",
        domain: cert.domain,
        expiresAt: cert.expiresAt ?? now,
        expired: true,
      });
    }
  }

  const expiringSoon = await db.sslCertificate.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        gte: now,
        lte: warningThreshold,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  for (const cert of expiringSoon) {
    if (!cert.expiresAt) {
      continue;
    }

    processedIds.push(cert.id);
    const fullName = `${cert.customer.name ?? ""} ${cert.customer.surname ?? ""}`.trim();
    await notifySslExpiry({
      customerId: cert.customer.id,
      email: cert.customer.email,
      fullName: fullName || "Müşteri",
      domain: cert.domain,
      expiresAt: cert.expiresAt,
      expired: false,
    });
  }

  return {
    processed: processedIds.length,
    ids: processedIds,
  };
}