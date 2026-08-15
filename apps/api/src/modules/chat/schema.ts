import { z } from "zod";

export const SendChatMessageSchema = z.object({
  messages: z.array(z.object({ role: z.string() }).loose()).min(1),
});

export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;
