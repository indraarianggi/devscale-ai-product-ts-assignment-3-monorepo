export type Gender = "MALE" | "FEMALE";
export type ActivityLevel =
  | "SEDENTARY"
  | "LIGHT"
  | "MODERATE"
  | "ACTIVE"
  | "VERY_ACTIVE";
export type Goal = "CUT" | "MAINTAIN" | "BULK";

export interface NutritionInput {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface NutritionTargets {
  targetCalories: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

const GOAL_CALORIE_ADJUSTMENT: Record<Goal, number> = {
  CUT: -500,
  MAINTAIN: 0,
  BULK: 300,
};

const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  CUT: 2.2,
  MAINTAIN: 1.8,
  BULK: 2.0,
};

export function calculateNutritionTargets(
  input: NutritionInput,
): NutritionTargets {
  const bmr =
    input.gender === "MALE"
      ? 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5
      : 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activityLevel];
  const targetCalories = Math.round(tdee + GOAL_CALORIE_ADJUSTMENT[input.goal]);

  const targetProteinG = Math.round(
    input.weightKg * GOAL_PROTEIN_PER_KG[input.goal],
  );
  const targetFatG = Math.round((targetCalories * 0.25) / 9);
  const remainingCalories =
    targetCalories - targetProteinG * 4 - targetFatG * 9;
  const targetCarbsG = Math.round(remainingCalories / 4);

  return { targetCalories, targetProteinG, targetFatG, targetCarbsG };
}
