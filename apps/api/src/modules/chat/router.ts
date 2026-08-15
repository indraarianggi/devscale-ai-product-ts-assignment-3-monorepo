import { Hono } from "hono";
import { createEventStream } from "@anvia/server";
import { SendChatMessageSchema } from "./schema";

interface ChatServiceLike {
  listMessages(mealPlanRequestId: string): Promise<unknown>;
  streamReply(
    mealPlanRequestId: string,
    messages: unknown[],
  ): Promise<AsyncIterable<unknown>>;
}

export function createChatRouter(service: ChatServiceLike) {
  return new Hono()
    .get("/:id/chat", async (c) => {
      const messages = await service.listMessages(c.req.param("id"));
      return c.json({ success: true, data: messages });
    })
    .post("/:id/chat", async (c) => {
      const parsed = SendChatMessageSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: { name: "ValidationError", message: parsed.error.message },
          },
          400,
        );
      }
      const stream = await service.streamReply(
        c.req.param("id"),
        parsed.data.messages,
      );
      return createEventStream(stream, { format: "jsonl" });
    });
}
