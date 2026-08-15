-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('CUT', 'MAINTAIN', 'BULK');

-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DayStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'REVISED');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "meal_plan_requests" (
    "id" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "activityLevel" "ActivityLevel" NOT NULL,
    "goal" "Goal" NOT NULL,
    "dietaryRestrictions" TEXT[],
    "allergies" TEXT[],
    "cuisinePreference" TEXT,
    "targetCalories" INTEGER NOT NULL,
    "targetProteinG" INTEGER NOT NULL,
    "targetCarbsG" INTEGER NOT NULL,
    "targetFatG" INTEGER NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "reportUrl" TEXT,
    "reportGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_days" (
    "id" TEXT NOT NULL,
    "mealPlanRequestId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "meals" TEXT NOT NULL,
    "estimatedCalories" INTEGER,
    "estimatedProteinG" INTEGER,
    "estimatedCarbsG" INTEGER,
    "estimatedFatG" INTEGER,
    "evaluationStatus" "DayStatus" NOT NULL DEFAULT 'PENDING',
    "evaluationFeedback" TEXT,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meal_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "mealPlanRequestId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_plan_requests_status_idx" ON "meal_plan_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_days_mealPlanRequestId_dayNumber_key" ON "meal_plan_days"("mealPlanRequestId", "dayNumber");

-- CreateIndex
CREATE INDEX "chat_messages_mealPlanRequestId_createdAt_idx" ON "chat_messages"("mealPlanRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "meal_plan_days" ADD CONSTRAINT "meal_plan_days_mealPlanRequestId_fkey" FOREIGN KEY ("mealPlanRequestId") REFERENCES "meal_plan_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_mealPlanRequestId_fkey" FOREIGN KEY ("mealPlanRequestId") REFERENCES "meal_plan_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
