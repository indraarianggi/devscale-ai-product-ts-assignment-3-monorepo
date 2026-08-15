import type { ErrorHandler } from "hono";
import { AppError } from "@/modules/meal-plan/errors";
import { logger } from "../lib/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { success: false, error: { name: err.name, message: err.message } },
      err.statusCode as 400 | 404 | 409,
    );
  }

  logger.error({ err }, "unhandled error");
  return c.json(
    {
      success: false,
      error: { name: "InternalServerError", message: "Something went wrong" },
    },
    500,
  );
};
