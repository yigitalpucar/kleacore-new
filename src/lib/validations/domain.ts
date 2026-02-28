import { z } from "zod";

export const dnsRecordSchema = z.object({
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"], {
    required_error: "DNS kayit tipi seciniz",
  }),
  name: z.string().min(1, "Kayit adi bos olamaz"),
  value: z.string().min(1, "Kayit degeri bos olamaz"),
  ttl: z.number().int().min(60, "TTL en az 60 saniye olmali").optional(),
  priority: z.number().int().min(0).optional(),
});

export const dnsRecordsUpdateSchema = z.object({
  domainId: z.string().min(1, "Alan adi ID gerekli"),
  records: z.array(dnsRecordSchema),
});

export type DnsRecordInput = z.infer<typeof dnsRecordSchema>;
export type DnsRecordsUpdateInput = z.infer<typeof dnsRecordsUpdateSchema>;
