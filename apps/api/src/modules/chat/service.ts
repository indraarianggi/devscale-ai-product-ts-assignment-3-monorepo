import { createCompletionStream, Message } from "@anvia/core";
import { getCompletionModel } from "@/lib/openai";
import { NotFoundError, ConflictError } from "@/modules/meal-plan/errors";
import { buildSystemPrompt, type MealPlanWithDays } from "./context";
import type { ChatRepository } from "./repository";

interface MealPlanRepositoryLike {
  findById: (id: string) => Promise<MealPlanWithDays | null>;
}

interface RawMessage {
  role: string;
  content?: unknown;
  parts?: unknown;
}

interface StreamEvent {
  type: string;
  delta?: string;
}

export interface ChatServiceDeps {
  streamCompletion: (input: unknown[]) => AsyncIterable<StreamEvent>;
}

const defaultDeps: ChatServiceDeps = {
  streamCompletion: (input) =>
    createCompletionStream(getCompletionModel(), {
      input: toAnviaMessages(input),
    }),
};

// Confirmed via a manual raw-body log (Task 16): @anvia/react's `useChat` sends
// `{ role, content: [{ type: "text", text }, ...] }` — content is an array of
// parts (assistant messages can also include non-text parts like "reasoning"),
// never a plain string, and never under a `parts` key. Both are still handled
// defensively in case that changes.
function extractText(message: RawMessage): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("");
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("");
  }
  return "";
}

// @anvia/core's Message type requires structured content (e.g. user/assistant
// content as an array of parts), not the raw `{ role, content: string }` shapes
// this service passes around internally — convert at the boundary instead of
// forcing that shape through the whole service (which the injected-dep tests
// deliberately don't require).
function toAnviaMessages(input: unknown[]): Message[] {
  return input.map((raw) => {
    const message = raw as RawMessage;
    const text = extractText(message);
    if (message.role === "system") return Message.system(text);
    if (message.role === "assistant") return Message.assistant(text);
    return Message.user(text);
  });
}

async function* tapAndPersist(
  stream: AsyncIterable<StreamEvent>,
  chatRepository: ChatRepository,
  mealPlanRequestId: string,
) {
  let fullText = "";
  try {
    for await (const event of stream) {
      if (event.type === "text_delta" && typeof event.delta === "string") {
        fullText += event.delta;
      }
      yield event;
    }
  } finally {
    if (fullText.length > 0) {
      await chatRepository.appendMessage(
        mealPlanRequestId,
        "ASSISTANT",
        fullText,
      );
    }
  }
}

export function createChatService(
  chatRepository: ChatRepository,
  mealPlanRepository: MealPlanRepositoryLike,
  deps: ChatServiceDeps = defaultDeps,
) {
  return {
    async listMessages(mealPlanRequestId: string) {
      const plan = await mealPlanRepository.findById(mealPlanRequestId);
      if (!plan)
        throw new NotFoundError(`Meal plan ${mealPlanRequestId} not found`);
      return chatRepository.listMessages(mealPlanRequestId);
    },

    async streamReply(mealPlanRequestId: string, messages: RawMessage[]) {
      const plan = await mealPlanRepository.findById(mealPlanRequestId);
      if (!plan)
        throw new NotFoundError(`Meal plan ${mealPlanRequestId} not found`);
      if (plan.status !== "COMPLETED") {
        throw new ConflictError(
          "Chat is only available once the meal plan report is ready",
        );
      }

      const newestUserMessage = messages.at(-1);
      if (newestUserMessage) {
        await chatRepository.appendMessage(
          mealPlanRequestId,
          "USER",
          extractText(newestUserMessage),
        );
      }

      const input = [
        { role: "system", content: buildSystemPrompt(plan) },
        ...messages,
      ];
      const stream = deps.streamCompletion(input);
      return tapAndPersist(stream, chatRepository, mealPlanRequestId);
    },
  };
}
