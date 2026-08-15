import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(8001),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6380),
  REDIS_DB: z.coerce.number().default(0),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
  REPORTS_DIR: z.string().default("reports"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export const env = loadEnv();
