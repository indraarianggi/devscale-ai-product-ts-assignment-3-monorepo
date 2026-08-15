import type { MealPlanJobData } from "@/queue/meal-plan.queue";
import { calculateNutritionTargets } from "@/lib/nutrition";
import { NotFoundError, ConflictError } from "./errors";
import type { CreateMealPlanInput, ListMealPlansQuery } from "./schema";
import type { MealPlanRepository } from "./repository";

interface QueueLike {
  add(name: string, data: MealPlanJobData): Promise<unknown>;
}

export function createMealPlanService(
  repository: MealPlanRepository,
  queue: QueueLike,
) {
  return {
    async create(input: CreateMealPlanInput) {
      const targets = calculateNutritionTargets(input);
      const request = await repository.create(input, targets);
      await queue.add("generate-meal-plan", { mealPlanRequestId: request.id });
      return toRequestDto(request);
    },

    async getById(id: string) {
      const request = await repository.findById(id);
      if (!request) throw new NotFoundError(`Meal plan ${id} not found`);
      return toRequestDto(request);
    },

    async list(query: ListMealPlansQuery) {
      const requests = await repository.list(query.page, query.limit);
      return requests.map(toRequestDto);
    },

    async getReportUrl(id: string): Promise<string> {
      const request = await repository.findById(id);
      if (!request) throw new NotFoundError(`Meal plan ${id} not found`);
      if (request.status !== "COMPLETED" || !request.reportUrl) {
        throw new ConflictError("Report is not ready yet");
      }
      return request.reportUrl;
    },
  };
}

export function toRequestDto(request: any) {
  return {
    id: request.id,
    status: request.status,
    goal: request.goal,
    targetCalories: request.targetCalories,
    targetProteinG: request.targetProteinG,
    targetCarbsG: request.targetCarbsG,
    targetFatG: request.targetFatG,
    reportUrl: request.reportUrl,
    createdAt: request.createdAt,
  };
}
