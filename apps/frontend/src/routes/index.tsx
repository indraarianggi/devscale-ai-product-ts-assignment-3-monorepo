import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "#/utils/api";

export const Route = createFileRoute("/")({
  component: CreatePlanForm,
});

function CreatePlanForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    age: 28,
    gender: "MALE" as const,
    weightKg: 78,
    heightCm: 178,
    activityLevel: "MODERATE" as const,
    goal: "CUT" as const,
    dietaryRestrictions: "",
    allergies: "",
    cuisinePreference: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api["meal-plans"].index.$post({
        json: {
          age: Number(form.age),
          gender: form.gender,
          weightKg: Number(form.weightKg),
          heightCm: Number(form.heightCm),
          activityLevel: form.activityLevel,
          goal: form.goal,
          dietaryRestrictions: form.dietaryRestrictions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          allergies: form.allergies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          cuisinePreference: form.cuisinePreference || undefined,
        },
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = (await res.json()) as any;
      navigate({ to: "/meal-plans/$id", params: { id: body.data.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 space-y-4">
      <h1 className="text-2xl font-bold">New Meal Plan</h1>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          Age
          <input
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          Gender
          <select
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value as any })
            }
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </label>
        <label className="block">
          Weight (kg)
          <input
            type="number"
            value={form.weightKg}
            onChange={(e) =>
              setForm({ ...form, weightKg: Number(e.target.value) })
            }
          />
        </label>
        <label className="block">
          Height (cm)
          <input
            type="number"
            value={form.heightCm}
            onChange={(e) =>
              setForm({ ...form, heightCm: Number(e.target.value) })
            }
          />
        </label>
        <label className="block">
          Activity level
          <select
            value={form.activityLevel}
            onChange={(e) =>
              setForm({ ...form, activityLevel: e.target.value as any })
            }
          >
            <option value="SEDENTARY">Sedentary</option>
            <option value="LIGHT">Light</option>
            <option value="MODERATE">Moderate</option>
            <option value="ACTIVE">Active</option>
            <option value="VERY_ACTIVE">Very active</option>
          </select>
        </label>
        <label className="block">
          Goal
          <select
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value as any })}
          >
            <option value="CUT">Cut</option>
            <option value="MAINTAIN">Maintain</option>
            <option value="BULK">Bulk</option>
          </select>
        </label>
        <label className="block">
          Dietary restrictions (comma-separated)
          <input
            value={form.dietaryRestrictions}
            onChange={(e) =>
              setForm({ ...form, dietaryRestrictions: e.target.value })
            }
          />
        </label>
        <label className="block">
          Allergies (comma-separated)
          <input
            value={form.allergies}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
          />
        </label>
        <label className="block">
          Cuisine preference
          <input
            value={form.cuisinePreference}
            onChange={(e) =>
              setForm({ ...form, cuisinePreference: e.target.value })
            }
          />
        </label>
        {error ? <p className="text-red-600 text-sm">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create meal plan"}
        </button>
      </form>
    </div>
  );
}
