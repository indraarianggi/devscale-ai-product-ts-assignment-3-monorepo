import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import Redis from "ioredis";
import { createMealPlanRouter } from "./modules/meal-plan/router";
import { createMealPlanService } from "./modules/meal-plan/service";
import { mealPlanRepository } from "./modules/meal-plan/repository";
import { mealPlanQueue } from "./queue/meal-plan.queue";
import { createHealthRouter } from "./routes/health";
import { errorHandler } from "./middleware/error-handler";
import { prismaClient } from "./lib/prisma";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const mealPlanService = createMealPlanService(
  mealPlanRepository,
  mealPlanQueue,
);

const redisPing = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: env.REDIS_DB,
});

const app = new OpenAPIHono()
  .use(cors())
  .onError(errorHandler)
  // Serves the PDF reports the worker writes to REPORTS_DIR — the
  // `/meal-plans/:id/report` redirect (see meal-plan/router.ts) points here.
  .use(`/${env.REPORTS_DIR}/*`, serveStatic({ root: "./" }))
  .route("/meal-plans", createMealPlanRouter(mealPlanService))
  .route(
    "/health",
    createHealthRouter({
      checkDb: async () => {
        await prismaClient.$queryRaw`SELECT 1`;
      },
      checkRedis: async () => {
        await redisPing.ping();
      },
    }),
  );

export type AppType = typeof app;

if (env.NODE_ENV !== "production") {
  // `.use(cors())` isn't overridden by OpenAPIHono (only `.route()`/`.onError()` are),
  // so the chained `app` above is statically typed as base `Hono` here even though it's
  // still the same OpenAPIHono instance at runtime — cast to call `.doc()`.
  (app as unknown as OpenAPIHono).doc("/doc", {
    openapi: "3.0.0",
    info: { title: "Meal Plan Coach API", version: "2.0.0" },
  });
  app.get("/reference", Scalar({ url: "/doc" }));
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Server is running on http://localhost:${info.port}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down server");
  server.close();
  await prismaClient.$disconnect();
  redisPing.disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
