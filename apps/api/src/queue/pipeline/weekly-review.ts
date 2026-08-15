import {
  getWeeklyReviewPrompt,
  WeeklyReviewSchema,
  type WeeklyReview,
} from "@/modules/meal-plan/prompts";
import { logger as defaultLogger } from "@/lib/logger";

type Logger = Pick<typeof defaultLogger, "debug" | "info">;

interface ReviewDay {
  dayNumber: number;
  meals: string;
}

interface Deps {
  generateStructured: (
    instructions: string,
    input: string,
    schema: typeof WeeklyReviewSchema,
  ) => Promise<WeeklyReview>;
}

export async function weeklyReview(
  days: ReviewDay[],
  deps: Deps,
  log: Logger = defaultLogger,
) {
  log.debug(
    { dayCount: days.length },
    "requesting weekly review (variety fix + shopping list)",
  );
  const prompt = getWeeklyReviewPrompt(days);
  const review = await deps.generateStructured(
    prompt,
    JSON.stringify(days),
    WeeklyReviewSchema,
  );
  log.debug(
    { revisedDays: review.revisedDays.map((d) => d.dayNumber) },
    "weekly review returned",
  );

  const revisedByDay = new Map(
    review.revisedDays.map((d) => [d.dayNumber, d.meals]),
  );
  const finalDays = days.map((day) => ({
    dayNumber: day.dayNumber,
    meals: revisedByDay.get(day.dayNumber) ?? day.meals,
  }));

  return {
    shoppingList: review.shoppingList,
    prepTips: review.prepTips,
    days: finalDays,
  };
}
