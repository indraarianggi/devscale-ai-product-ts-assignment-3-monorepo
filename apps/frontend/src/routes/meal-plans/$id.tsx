import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "#/utils/api";
import { ChatPanel } from "#/components/chat-panel";

// See routes/meal-plans/index.tsx for why this needs an explicit cast.
interface MealPlanDetailDto {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  goal: "CUT" | "MAINTAIN" | "BULK";
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  reportUrl: string | null;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8002";

export const Route = createFileRoute("/meal-plans/$id")({
  component: MealPlanDetail,
  loader: async ({ params }) => {
    const res = await api["meal-plans"][":id"].$get({
      param: { id: params.id },
    });
    const body = await res.json() as any;
    return body.data as MealPlanDetailDto;
  },
});

function MealPlanDetail() {
  const initial = Route.useLoaderData();
  const { id } = Route.useParams();
  const [plan, setPlan] = useState(initial);

  useEffect(() => {
    if (plan.status === "COMPLETED" || plan.status === "FAILED") return;
    const interval = setInterval(async () => {
      const res = await api["meal-plans"][":id"].$get({ param: { id } });
      const body = await res.json() as any;
      setPlan(body.data as MealPlanDetailDto);
    }, 3000);
    return () => clearInterval(interval);
  }, [id, plan.status]);

  const isReady = plan.status === "COMPLETED" && plan.reportUrl;
  const reportUrl = `${API_BASE_URL}/meal-plans/${id}/report`;

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold">
          {plan.goal} plan — {plan.status}
        </h1>
        {isReady ? (
          <a
            href={reportUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="primary"
          >
            Download PDF report
          </a>
        ) : null}
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-1/2 flex flex-col min-h-0 border-r">
          <dl className="shrink-0 grid grid-cols-2 gap-2 text-sm border-b px-6 py-4">
            <dt>Calories</dt>
            <dd>{plan.targetCalories} kcal</dd>
            <dt>Protein</dt>
            <dd>{plan.targetProteinG} g</dd>
            <dt>Carbs</dt>
            <dd>{plan.targetCarbsG} g</dd>
            <dt>Fat</dt>
            <dd>{plan.targetFatG} g</dd>
          </dl>

          <div className="flex-1 min-h-0">
            {isReady ? (
              <iframe
                title="Meal plan report"
                src={reportUrl}
                className="w-full h-full"
              />
            ) : (
              <p className="text-gray-500 px-6 py-4">
                Generating your week of meals... this can take a few minutes.
              </p>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col min-h-0">
          {plan.status === "COMPLETED" ? (
            <ChatPanel mealPlanId={id} />
          ) : (
            <p className="text-gray-500 px-6 py-4">
              Chat unlocks once the plan is ready.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
