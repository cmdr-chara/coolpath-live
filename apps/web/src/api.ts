import {
  apiCityResponseEnvelopeSchema,
  apiCitySummaryListEnvelopeSchema,
  apiUnknownEnvelopeSchema
} from "@coolpath/domain";
import type { CityResponse, CitySummary } from "./types";

const baseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "");
const configuredCitySlug = String(import.meta.env.VITE_CITY_SLUG ?? "").trim();

interface EnvelopeParser<T> {
  parse(value: unknown): { data: T };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  path: string,
  parser: EnvelopeParser<T>,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // The status code remains the safe fallback when a response is not JSON.
    }
    throw new ApiRequestError(message, response.status);
  }

  try {
    const payload: unknown = await response.json();
    return parser.parse(payload).data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("The API response violated the shared CoolPath contract.", 502);
  }
}

export async function getDirectory(): Promise<CityResponse> {
  const cities: CitySummary[] = await request("/api/cities", apiCitySummaryListEnvelopeSchema);
  const selected = configuredCitySlug
    ? cities.find((city) => city.slug === configuredCitySlug)
    : (cities.find((city) => city.mode === "real") ?? cities[0]);

  if (!selected) throw new Error("No configured city is available.");
  return request(
    `/api/cities/${encodeURIComponent(selected.slug)}`,
    apiCityResponseEnvelopeSchema
  );
}

export function runDemoAction(action: "reset" | "drift" | "heal"): Promise<unknown> {
  return request(`/api/demo/${action}`, apiUnknownEnvelopeSchema, { method: "POST" });
}

export function decideHeal(approve: boolean): Promise<unknown> {
  return request("/api/demo/heal/decision", apiUnknownEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify({ approve })
  });
}
