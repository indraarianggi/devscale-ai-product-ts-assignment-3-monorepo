import { z } from "@hono/zod-openapi";
import { SuccessResponseSchema } from "@/lib/openapi-schemas";

export const CreateMealPlanSchema = z
  .object({
    age: z
      .number()
      .int()
      .min(13)
      .max(100)
      .openapi({ example: 30, description: "Age in years" }),
    gender: z.enum(["MALE", "FEMALE"]).openapi({ example: "MALE" }),
    weightKg: z
      .number()
      .positive()
      .max(400)
      .openapi({ example: 78, description: "Weight in kilograms" }),
    heightCm: z
      .number()
      .positive()
      .max(300)
      .openapi({ example: 178, description: "Height in centimeters" }),
    activityLevel: z
      .enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"])
      .openapi({ example: "MODERATE" }),
    goal: z.enum(["CUT", "MAINTAIN", "BULK"]).openapi({ example: "CUT" }),
    dietaryRestrictions: z
      .array(z.string())
      .default([])
      .openapi({ example: ["pescatarian"] }),
    allergies: z
      .array(z.string())
      .default([])
      .openapi({ example: ["shellfish"] }),
    cuisinePreference: z
      .string()
      .optional()
      .openapi({ example: "Mediterranean" }),
  })
  .openapi("CreateMealPlanRequest");

export type CreateMealPlanInput = z.infer<typeof CreateMealPlanSchema>;

export const ListMealPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .openapi({ example: 10 }),
});

export type ListMealPlansQuery = z.infer<typeof ListMealPlansQuerySchema>;

export const MealPlanDtoSchema = z
  .object({
    id: z.string().openapi({ example: "mp_1" }),
    status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
    goal: z.enum(["CUT", "MAINTAIN", "BULK"]),
    targetCalories: z.number().openapi({ example: 2200 }),
    targetProteinG: z.number().openapi({ example: 165 }),
    targetCarbsG: z.number().openapi({ example: 220 }),
    targetFatG: z.number().openapi({ example: 73 }),
    reportUrl: z.string().nullable().openapi({ example: null }),
    createdAt: z.iso.datetime(),
  })
  .openapi("MealPlanDto");

export const MealPlanResponseSchema =
  SuccessResponseSchema(MealPlanDtoSchema).openapi("MealPlanResponse");
export const MealPlanListResponseSchema = SuccessResponseSchema(
  z.array(MealPlanDtoSchema),
).openapi("MealPlanListResponse");
