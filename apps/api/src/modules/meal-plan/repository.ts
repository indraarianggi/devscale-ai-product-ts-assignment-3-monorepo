import { prismaClient } from "@/lib/prisma";
import type { DayStatus, MealPlanStatus } from "@/generated/prisma/client";
import type { CreateMealPlanInput } from "./schema";
import type { NutritionTargets } from "@/lib/nutrition";

export const mealPlanRepository = {
  create(input: CreateMealPlanInput, targets: NutritionTargets) {
    return prismaClient.mealPlanRequest.create({
      data: { ...input, ...targets },
    });
  },

  findById(id: string) {
    return prismaClient.mealPlanRequest.findUnique({
      where: { id },
      include: { days: true },
    });
  },

  list(page: number, limit: number) {
    return prismaClient.mealPlanRequest.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  },

  updateStatus(id: string, status: MealPlanStatus) {
    return prismaClient.mealPlanRequest.update({
      where: { id },
      data: { status },
    });
  },

  complete(id: string, reportUrl: string) {
    return prismaClient.mealPlanRequest.update({
      where: { id },
      data: { status: "COMPLETED", reportUrl, reportGeneratedAt: new Date() },
    });
  },

  fail(id: string, failureReason: string) {
    return prismaClient.mealPlanRequest.update({
      where: { id },
      data: { status: "FAILED", failureReason },
    });
  },

  upsertDay(
    mealPlanRequestId: string,
    dayNumber: number,
    data: {
      meals: string;
      estimatedCalories: number;
      estimatedProteinG: number;
      estimatedCarbsG: number;
      estimatedFatG: number;
      evaluationStatus: DayStatus;
      evaluationFeedback: string;
      revisionCount: number;
    },
  ) {
    return prismaClient.mealPlanDay.upsert({
      where: { mealPlanRequestId_dayNumber: { mealPlanRequestId, dayNumber } },
      create: { mealPlanRequestId, dayNumber, ...data },
      update: data,
    });
  },
};

export type MealPlanRepository = typeof mealPlanRepository;
