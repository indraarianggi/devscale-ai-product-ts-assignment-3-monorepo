import { z } from "zod";
import type { NutritionTargets } from "@/lib/nutrition";

export const DayEvaluationSchema = z.object({
  passed: z.boolean(),
  estimatedCalories: z.number(),
  estimatedProteinG: z.number(),
  estimatedCarbsG: z.number(),
  estimatedFatG: z.number(),
  feedback: z.string(),
});
export type DayEvaluation = z.infer<typeof DayEvaluationSchema>;

export const WeeklyReviewSchema = z.object({
  shoppingList: z.array(z.string()),
  prepTips: z.array(z.string()),
  revisedDays: z.array(z.object({ dayNumber: z.number(), meals: z.string() })),
});
export type WeeklyReview = z.infer<typeof WeeklyReviewSchema>;

export function getDayMealPlanPrompt(
  dayNumber: number,
  targets: NutritionTargets,
  restrictions: string[],
  allergies: string[],
  cuisinePreference: string | undefined,
  avoidMeals: string[],
): string {
  return `
You are a meal-planning nutritionist. Generate Day ${dayNumber} of a 7-day meal plan.

<targets>
Calories: ${targets.targetCalories} kcal
Protein: ${targets.targetProteinG} g
Carbs: ${targets.targetCarbsG} g
Fat: ${targets.targetFatG} g
</targets>

<constraints>
Dietary restrictions: ${restrictions.join(", ") || "None"}
Allergies: ${allergies.join(", ") || "None"}
Cuisine preference: ${cuisinePreference ?? "No preference"}
Avoid repeating these meals: ${avoidMeals.join(", ") || "None"}
</constraints>

<output_format>
List Breakfast, Lunch, Dinner, and up to 2 Snacks as a markdown section.
For each item give the dish name, portion size, and estimated calories/macros.
Do not include a top-level "Day ${dayNumber}" title or heading — the report
assembles that itself. Start directly with the "Breakfast" heading.
</output_format>
`.trim();
}

export function getDayEvaluationPrompt(
  dayMeals: string,
  targets: NutritionTargets,
): string {
  return `
Evaluate whether this day's meals hit the nutrition targets within 10% tolerance.

<targets>
Calories: ${targets.targetCalories} kcal
Protein: ${targets.targetProteinG} g
Carbs: ${targets.targetCarbsG} g
Fat: ${targets.targetFatG} g
</targets>

<day_meals>
${dayMeals}
</day_meals>

Estimate the actual totals from the listed meals and return whether they pass.
`.trim();
}

export function getDayRevisionPrompt(
  dayMeals: string,
  feedback: string,
  targets: NutritionTargets,
  dayNumber?: number,
): string {
  return `
Revise ${dayNumber !== undefined ? `Day ${dayNumber}'s` : "this day's"} meals to fix the evaluator's feedback while keeping the same
general style and avoiding an increase in prep complexity.

<targets>
Calories: ${targets.targetCalories} kcal
Protein: ${targets.targetProteinG} g
Carbs: ${targets.targetCarbsG} g
Fat: ${targets.targetFatG} g
</targets>

<original_meals>
${dayMeals}
</original_meals>

<evaluator_feedback>
${feedback}
</evaluator_feedback>
`.trim();
}

export function getWeeklyReviewPrompt(
  days: Array<{ dayNumber: number; meals: string }>,
): string {
  const daysBlock = days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => `<day number="${day.dayNumber}">\n${day.meals}\n</day>`)
    .join("\n\n");

  return `
Review this full week of meals.

1. Identify meals repeated across multiple days and rewrite the repeated
   occurrences with a variation of similar nutrition profile. Only include a
   day in "revisedDays" if you changed it.
2. Produce a single consolidated shopping list covering all 7 days.
3. Produce 3-5 batch-prep tips for the week.

<week>
${daysBlock}
</week>
`.trim();
}
