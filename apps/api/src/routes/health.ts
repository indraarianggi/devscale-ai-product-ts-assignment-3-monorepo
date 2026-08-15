import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

interface HealthDeps {
  checkDb: () => Promise<void>;
  checkRedis: () => Promise<void>;
}

const healthRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ status: z.literal("ok") }) },
      },
      description: "Database and Redis are reachable",
    },
    503: {
      content: {
        "application/json": {
          schema: z.object({ status: z.literal("unavailable") }),
        },
      },
      description: "A dependency check failed",
    },
  },
});

export function createHealthRouter(deps: HealthDeps) {
  return new OpenAPIHono().openapi(healthRoute, async (c) => {
    try {
      await Promise.all([deps.checkDb(), deps.checkRedis()]);
      return c.json({ status: "ok" as const }, 200);
    } catch {
      return c.json({ status: "unavailable" as const }, 503);
    }
  });
}
