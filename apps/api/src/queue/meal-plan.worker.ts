import { Worker, type Job } from "bullmq";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mealPlanRepository } from "@/modules/meal-plan/repository";
import { generateText, generateStructured } from "@/lib/ai-generation";
import { writeMarkdownPdf } from "@/lib/markdown-pdf";
import { LocalDiskReportStorage } from "@/lib/storage";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import {
  MEAL_PLAN_QUEUE_NAME,
  connection,
  type MealPlanJobData,
} from "./meal-plan.queue";
import { generateAllDays } from "./pipeline/generate-all-days";
import { weeklyReview } from "./pipeline/weekly-review";
import { buildReportMarkdown } from "./pipeline/build-report-markdown";

const storage = new LocalDiskReportStorage(env.REPORTS_DIR);

const callbackFn = async (job: Job<MealPlanJobData>) => {
  const requestId = job.data.mealPlanRequestId;
  const log = logger.child({
    jobId: job.id,
    requestId,
    attempt: job.attemptsMade + 1,
  });

  log.info("job started");

  const request = await mealPlanRepository.findById(requestId);
  if (!request) {
    throw new Error(`MealPlanRequest ${requestId} not found`);
  }
  if (request.status === "COMPLETED") {
    log.info("job already completed, skipping");
    return;
  }

  await mealPlanRepository.updateStatus(request.id, "PROCESSING");
  log.info("status set to PROCESSING");

  const targets = {
    targetCalories: request.targetCalories,
    targetProteinG: request.targetProteinG,
    targetCarbsG: request.targetCarbsG,
    targetFatG: request.targetFatG,
  };

  log.info(
    { existingDays: request.days.length },
    "step 1/4: generating day meal plans (fan-out)",
  );
  const days = await generateAllDays(
    targets,
    request.dietaryRestrictions,
    request.allergies,
    request.cuisinePreference ?? undefined,
    request.days,
    { generateText, generateStructured },
    log,
  );
  log.info(
    { daysGenerated: days.length },
    "step 1/4 done: all day meal plans ready",
  );

  log.info("step 2/4: persisting per-day results");
  for (const day of days) {
    await mealPlanRepository.upsertDay(request.id, day.dayNumber, {
      meals: day.meals,
      estimatedCalories: day.estimatedCalories,
      estimatedProteinG: day.estimatedProteinG,
      estimatedCarbsG: day.estimatedCarbsG,
      estimatedFatG: day.estimatedFatG,
      evaluationStatus: day.evaluationStatus,
      evaluationFeedback: day.evaluationFeedback,
      revisionCount: day.revisionCount,
    });
    log.debug(
      { dayNumber: day.dayNumber, evaluationStatus: day.evaluationStatus },
      "day persisted",
    );
  }
  log.info("step 2/4 done: all days persisted");

  log.info("step 3/4: weekly review (variety fix + shopping list)");
  const review = await weeklyReview(days, { generateStructured }, log);
  log.info(
    {
      shoppingListItems: review.shoppingList.length,
      prepTips: review.prepTips.length,
    },
    "step 3/4 done: weekly review complete",
  );

  const markdown = buildReportMarkdown({
    request: { goal: request.goal, ...targets },
    days: review.days,
    shoppingList: review.shoppingList,
    prepTips: review.prepTips,
  });
  log.info({ markdownLength: markdown.length }, "report markdown assembled");

  log.info("step 4/4: rendering and storing PDF report");
  const tempDir = await mkdtemp(path.join(tmpdir(), "meal-plan-report-"));
  const tempPdfPath = path.join(tempDir, `${request.id}.pdf`);
  try {
    await writeMarkdownPdf(markdown, tempPdfPath);
    log.info({ tempPdfPath }, "PDF rendered");
    const reportUrl = await storage.save(tempPdfPath, `${request.id}.pdf`);
    log.info({ reportUrl }, "PDF uploaded to storage");
    await mealPlanRepository.complete(request.id, reportUrl);
    log.info({ reportUrl }, "step 4/4 done: meal plan job completed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export const mealPlanWorker = new Worker<MealPlanJobData>(
  MEAL_PLAN_QUEUE_NAME,
  callbackFn,
  {
    connection,
    concurrency: 2,
  },
);

mealPlanWorker.on("failed", async (job, err) => {
  if (!job) return;
  const willRetry = job.attemptsMade < (job.opts.attempts ?? 1);
  logger.error(
    {
      jobId: job.id,
      requestId: job.data.mealPlanRequestId,
      attempt: job.attemptsMade,
      willRetry,
      err,
    },
    "meal plan job failed",
  );
  if (!willRetry) {
    await mealPlanRepository.fail(job.data.mealPlanRequestId, err.message);
  }
});
