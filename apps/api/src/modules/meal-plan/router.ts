import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ValidationErrorResponseSchema,
  DomainErrorResponseSchema,
} from "@/lib/openapi-schemas";
import {
  CreateMealPlanSchema,
  ListMealPlansQuerySchema,
  MealPlanResponseSchema,
  MealPlanListResponseSchema,
  MealPlanDtoSchema,
  type CreateMealPlanInput,
  type ListMealPlansQuery,
} from "./schema";

type MealPlanDto = z.infer<typeof MealPlanDtoSchema>;

interface MealPlanServiceLike {
  create: (input: CreateMealPlanInput) => Promise<unknown>;
  list: (query: ListMealPlansQuery) => Promise<unknown>;
  getById: (id: string) => Promise<unknown>;
  getReportUrl: (id: string) => Promise<string>;
}

const IdParamSchema = z.object({
  id: z
    .string()
    .openapi({ example: "mp_1", description: "Meal plan request ID" }),
});

const createMealPlanRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: { content: { "application/json": { schema: CreateMealPlanSchema } } },
  },
  responses: {
    201: {
      content: { "application/json": { schema: MealPlanResponseSchema } },
      description: "Meal plan request created",
    },
    400: {
      content: {
        "application/json": { schema: ValidationErrorResponseSchema },
      },
      description: "Invalid input",
    },
  },
});

const listMealPlansRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: ListMealPlansQuerySchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: MealPlanListResponseSchema } },
      description: "Paginated meal plan requests",
    },
    400: {
      content: {
        "application/json": { schema: ValidationErrorResponseSchema },
      },
      description: "Invalid query params",
    },
  },
});

const getMealPlanRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: MealPlanResponseSchema } },
      description: "Meal plan request",
    },
    404: {
      content: { "application/json": { schema: DomainErrorResponseSchema } },
      description: "Meal plan not found",
    },
  },
});

const getMealPlanReportRoute = createRoute({
  method: "get",
  path: "/{id}/report",
  request: {
    params: IdParamSchema,
  },
  responses: {
    302: { description: "Redirect to the generated PDF report" },
    404: {
      content: { "application/json": { schema: DomainErrorResponseSchema } },
      description: "Meal plan not found",
    },
    409: {
      content: { "application/json": { schema: DomainErrorResponseSchema } },
      description: "Report is not ready yet",
    },
  },
});

export function createMealPlanRouter(service: MealPlanServiceLike) {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: {
              name: "ValidationError",
              message: JSON.parse(result.error.message),
            },
          },
          400,
        );
      }
    },
  })
    .openapi(createMealPlanRoute, async (c) => {
      const dto = await service.create(c.req.valid("json"));
      return c.json({ success: true, data: dto as MealPlanDto }, 201);
    })
    .openapi(listMealPlansRoute, async (c) => {
      const dto = await service.list(c.req.valid("query"));
      return c.json({ success: true, data: dto as MealPlanDto[] }, 200);
    })
    .openapi(getMealPlanRoute, async (c) => {
      const dto = await service.getById(c.req.valid("param").id);
      return c.json({ success: true, data: dto as MealPlanDto }, 200);
    })
    .openapi(getMealPlanReportRoute, async (c) => {
      const key = await service.getReportUrl(c.req.valid("param").id);
      // `key` is the storage-relative path returned by ReportStorage.save()
      // (e.g. "reports/mp_1.pdf") — prefix with "/" so the browser resolves
      // it against the API origin, matching the static mount in index.ts,
      // instead of relative to the current /meal-plans/:id/report path.
      return c.redirect(`/${key}`);
    });
}
