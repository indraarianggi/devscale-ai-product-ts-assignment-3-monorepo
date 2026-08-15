import type { MealPlanDay, MealPlanRequest } from "@/generated/prisma/client";

export type MealPlanWithDays = MealPlanRequest & { days: MealPlanDay[] };

export function buildSystemPrompt(plan: MealPlanWithDays): string {
  const daysBlock = [...plan.days]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => `<day number="${day.dayNumber}">\n${day.meals}\n</day>`)
    .join("\n\n");

  return `
You are a friendly nutrition coach. Answer the user's questions about the
meal plan below. Only reference meals, totals, or swaps that are actually
in the plan data — do not invent dishes that aren't listed.

<targets>
Goal: ${plan.goal}
Calories: ${plan.targetCalories} kcal
Protein: ${plan.targetProteinG} g
Carbs: ${plan.targetCarbsG} g
Fat: ${plan.targetFatG} g
</targets>

<constraints>
Dietary restrictions: ${plan.dietaryRestrictions.join(", ") || "None"}
Allergies: ${plan.allergies.join(", ") || "None"}
Cuisine preference: ${plan.cuisinePreference ?? "No preference"}
</constraints>

<week>
${daysBlock}
</week>
`.trim();
}
