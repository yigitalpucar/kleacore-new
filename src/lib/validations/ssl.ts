import { z } from "zod";

export const sslToggleAutoRenewSchema = z.object({
  certificateId: z.string().min(1, "Sertifika ID gerekli"),
});

export type SslToggleAutoRenewInput = z.infer<typeof sslToggleAutoRenewSchema>;
