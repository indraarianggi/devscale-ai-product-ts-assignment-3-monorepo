import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "@/config/env";

export const MEAL_PLAN_QUEUE_NAME = "meal-plan-queue";

export const connection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: env.REDIS_DB,
};

export const mealPlanQueue = new Queue(MEAL_PLAN_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: false,
  },
});

export interface MealPlanJobData {
  mealPlanRequestId: string;
}
