import { prismaClient } from "@/lib/prisma";
import type { ChatRole } from "@/generated/prisma/client";

export const chatRepository = {
  listMessages(mealPlanRequestId: string) {
    return prismaClient.chatMessage.findMany({
      where: { mealPlanRequestId },
      orderBy: { createdAt: "asc" },
    });
  },

  appendMessage(mealPlanRequestId: string, role: ChatRole, content: string) {
    return prismaClient.chatMessage.create({
      data: { mealPlanRequestId, role, content },
    });
  },
};

export type ChatRepository = typeof chatRepository;
