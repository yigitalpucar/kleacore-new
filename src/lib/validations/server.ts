import { z } from "zod";

export const serverIdSchema = z.object({
  id: z.string().min(1, "Sunucu ID gerekli"),
});

export type ServerIdInput = z.infer<typeof serverIdSchema>;
