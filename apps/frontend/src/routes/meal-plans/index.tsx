import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "#/utils/api";

interface MealPlanSummary {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  goal: "CUT" | "MAINTAIN" | "BULK";
  targetCalories: number;
}

export const Route = createFileRoute("/meal-plans/")({
  component: MealPlanList,
  loader: async () => {
    const res = await api["meal-plans"].index.$get({
      query: { page: "1", limit: "20" },
    });
    if (!res.ok) throw new Error("Failed to fetch meal plans");
    const body = (await res.json()) as { data: MealPlanSummary[] };
    return body.data;
  },
});

function MealPlanList() {
  const plans = Route.useLoaderData();

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meal Plans</h1>
        <Link to="/" className="text-blue-600 underline">
          New plan
        </Link>
      </div>
      <ul className="space-y-2">
        {plans.map((plan) => (
          <li key={plan.id} className="border rounded-md p-4">
            <Link
              to="/meal-plans/$id"
              params={{ id: plan.id }}
              className="flex justify-between"
            >
              <span>
                {plan.goal} — {plan.targetCalories} kcal
              </span>
              <span className="text-sm text-gray-500">{plan.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
