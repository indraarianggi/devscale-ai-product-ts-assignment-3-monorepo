import { prismaClient } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { mealPlanWorker } from "@/queue/meal-plan.worker";

logger.info("meal-plan worker started");

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down worker");
  await mealPlanWorker.close();
  await prismaClient.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
