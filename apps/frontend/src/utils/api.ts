import { hc } from "hono/client";
import type { AppType } from "../../../api/src";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8002";

export const api = hc<AppType>(API_BASE_URL);
