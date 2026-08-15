import {
  getDayMealPlanPrompt,
  getDayEvaluationPrompt,
  getDayRevisionPrompt,
  DayEvaluationSchema,
  type DayEvaluation,
} from "@/modules/meal-plan/prompts";
import { logger as defaultLogger } from "@/lib/logger";
import type { NutritionTargets } from "@/lib/nutrition";

type Logger = Pick<typeof defaultLogger, "debug" | "info" | "warn">;

export interface DayResult {
  dayNumber: number;
  meals: string;
  estimatedCalories: number;
  estimatedProteinG: number;
  estimatedCarbsG: number;
  estimatedFatG: number;
  evaluationStatus: "PASSED" | "FAILED" | "REVISED";
  evaluationFeedback: string;
  revisionCount: number;
}

interface ExistingDay {
  dayNumber: number;
  evaluationStatus: string;
  meals: string;
}

export interface PipelineDeps {
  generateText: (instructions: string, input: string) => Promise<string>;
  generateStructured: (
    instructions: string,
    input: string,
    schema: typeof DayEvaluationSchema,
  ) => Promise<DayEvaluation>;
}

const RESUMABLE_STATUSES = new Set(["PASSED", "REVISED"]);

async function generateOneDay(
  dayNumber: number,
  targets: NutritionTargets,
  restrictions: string[],
  allergies: string[],
  cuisinePreference: string | undefined,
  avoidMeals: string[],
  deps: PipelineDeps,
  log: Logger,
): Promise<DayResult> {
  log.debug({ dayNumber }, "generating day meals");
  const genPrompt = getDayMealPlanPrompt(
    dayNumber,
    targets,
    restrictions,
    allergies,
    cuisinePreference,
    avoidMeals,
  );
  let meals = await deps.generateText(genPrompt, "");

  log.debug({ dayNumber }, "evaluating day meals against targets");
  let evaluation = await deps.generateStructured(
    getDayEvaluationPrompt(meals, targets),
    meals,
    DayEvaluationSchema,
  );

  let revisionCount = 0;
  let status: DayResult["evaluationStatus"] = evaluation.passed
    ? "PASSED"
    : "FAILED";
  log.debug({ dayNumber, passed: evaluation.passed }, "day evaluation result");

  if (!evaluation.passed) {
    log.debug(
      { dayNumber, feedback: evaluation.feedback },
      "day failed evaluation, revising",
    );
    meals = await deps.generateText(
      getDayRevisionPrompt(meals, evaluation.feedback, targets, dayNumber),
      "",
    );
    evaluation = await deps.generateStructured(
      getDayEvaluationPrompt(meals, targets),
      meals,
      DayEvaluationSchema,
    );
    revisionCount = 1;
    status = evaluation.passed ? "REVISED" : "FAILED";
    log.debug({ dayNumber, status }, "day revision evaluation result");
  }

  log.debug({ dayNumber, status, revisionCount }, "day generation complete");

  return {
    dayNumber,
    meals,
    estimatedCalories: evaluation.estimatedCalories,
    estimatedProteinG: evaluation.estimatedProteinG,
    estimatedCarbsG: evaluation.estimatedCarbsG,
    estimatedFatG: evaluation.estimatedFatG,
    evaluationStatus: status,
    evaluationFeedback: evaluation.feedback,
    revisionCount,
  };
}

export async function generateAllDays(
  targets: NutritionTargets,
  restrictions: string[],
  allergies: string[],
  cuisinePreference: string | undefined,
  existingDays: ExistingDay[],
  deps: PipelineDeps,
  log: Logger = defaultLogger,
): Promise<DayResult[]> {
  const resumableDays = existingDays.filter((d) =>
    RESUMABLE_STATUSES.has(d.evaluationStatus),
  );
  const resumableDayNumbers = new Set(resumableDays.map((d) => d.dayNumber));

  const dayNumbersToGenerate = Array.from(
    { length: 7 },
    (_, i) => i + 1,
  ).filter((dayNumber) => !resumableDayNumbers.has(dayNumber));

  log.info(
    { toGenerate: dayNumbersToGenerate, resumed: [...resumableDayNumbers] },
    "fan-out: generating days in parallel",
  );

  // Initial generation never knows about other days' content yet — variety
  // across the week is fixed later in the weekly-review chaining step, not here.
  const settled = await Promise.allSettled(
    dayNumbersToGenerate.map((dayNumber) =>
      generateOneDay(
        dayNumber,
        targets,
        restrictions,
        allergies,
        cuisinePreference,
        [],
        deps,
        log,
      ),
    ),
  );

  const rejected = settled.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (rejected.length > 0) {
    log.warn(
      { rejectedCount: rejected.length, reason: rejected[0].reason },
      "one or more days failed to generate",
    );
    throw new Error(
      `${rejected.length} day(s) failed to generate: ${rejected[0].reason}`,
    );
  }

  const generated = settled
    .filter(
      (r): r is PromiseFulfilledResult<DayResult> => r.status === "fulfilled",
    )
    .map((r) => r.value);

  const resumed: DayResult[] = resumableDays.map((d) => ({
    dayNumber: d.dayNumber,
    meals: d.meals,
    estimatedCalories: 0,
    estimatedProteinG: 0,
    estimatedCarbsG: 0,
    estimatedFatG: 0,
    evaluationStatus: d.evaluationStatus as DayResult["evaluationStatus"],
    evaluationFeedback: "",
    revisionCount: 0,
  }));

  return [...resumed, ...generated].sort((a, b) => a.dayNumber - b.dayNumber);
}
