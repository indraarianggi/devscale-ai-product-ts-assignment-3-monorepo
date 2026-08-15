import type { z } from "zod";
import { createCompletion, createParsedCompletion } from "@anvia/core";
import { getCompletionModel } from "@/lib/openai";

export async function generateText(
  instructions: string,
  input: string,
): Promise<string> {
  const response = await createCompletion(getCompletionModel(), {
    instructions,
    input,
  });
  return response.text;
}

export async function generateStructured<T extends z.ZodTypeAny>(
  instructions: string,
  input: string,
  schema: T,
): Promise<z.infer<T>> {
  const response = await createParsedCompletion<
    z.infer<T>,
    ReturnType<typeof getCompletionModel>
  >(getCompletionModel(), {
    instructions,
    input,
    schema: schema as z.ZodType<z.infer<T>>,
  });
  return response.data;
}
