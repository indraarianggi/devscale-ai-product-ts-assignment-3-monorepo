import { OpenAIClient } from "@anvia/openai";
import { env } from "@/config/env";

let cachedClient: OpenAIClient | undefined;

export function getAiClient() {
  if (!cachedClient) {
    cachedClient = new OpenAIClient({
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
    });
  }
  return cachedClient;
}

export function getCompletionModel(model = "deepseek/deepseek-v4-flash") {
  return getAiClient().completionModel(model);
}
