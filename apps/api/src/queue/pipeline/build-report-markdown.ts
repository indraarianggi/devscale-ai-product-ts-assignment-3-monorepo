interface ReportRequest {
  goal: string;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
}

interface ReportDay {
  dayNumber: number;
  meals: string;
}

interface BuildReportInput {
  request: ReportRequest;
  days: ReportDay[];
  shoppingList: string[];
  prepTips: string[];
}

export function buildReportMarkdown({
  request,
  days,
  shoppingList,
  prepTips,
}: BuildReportInput): string {
  const summary = `# Meal Plan Report

Goal: ${request.goal}
Daily targets: ${request.targetCalories} kcal / ${request.targetProteinG}g protein / ${request.targetCarbsG}g carbs / ${request.targetFatG}g fat`;

  const daySections = [...days]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map(
      (day) =>
        `## Day ${day.dayNumber}\n\n${stripLeadingDayHeading(day.meals, day.dayNumber)}`,
    )
    .join("\n\n");

  const shoppingSection = `## Shopping List\n\n${shoppingList.map((item) => `- ${item}`).join("\n")}`;
  const prepSection = `## Prep Tips\n\n${prepTips.map((tip) => `- ${tip}`).join("\n")}`;

  return [summary, daySections, shoppingSection, prepSection].join("\n\n");
}

// Belt-and-suspenders: the model is instructed not to include its own "Day N"
// heading, but strip one if it slips through so the report never renders it twice.
function stripLeadingDayHeading(meals: string, dayNumber: number): string {
  const pattern = new RegExp(
    `^\\s*#{1,6}\\s*day\\s*${dayNumber}\\b[^\n]*\n+`,
    "i",
  );
  return meals.replace(pattern, "");
}
