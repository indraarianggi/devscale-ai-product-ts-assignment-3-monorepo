import { z } from "@hono/zod-openapi";

const ZodIssueSchema = z
  .object({
    code: z.string(),
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
  })
  .loose();

export const ValidationErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      name: z.literal("ValidationError"),
      message: z.array(ZodIssueSchema),
    }),
  })
  .openapi("ValidationErrorResponse");

export const DomainErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      name: z.string(),
      message: z.string(),
    }),
  })
  .openapi("DomainErrorResponse");

export function SuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}
