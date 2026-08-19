import type { ApiEnvelope, CityResponse, CitySummary } from "./types";

const baseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "");
const configuredCitySlug = String(import.meta.env.VITE_CITY_SLUG ?? "").trim();

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.data;
}

export async function getDirectory(): Promise<CityResponse> {
  const cities = await request<CitySummary[]>("/api/cities");
  const selected = configuredCitySlug
    ? cities.find((city) => city.slug === configuredCitySlug)
    : (cities.find((city) => city.mode === "real") ?? cities[0]);

  if (!selected) throw new Error("No configured city is available.");
  return request<CityResponse>(`/api/cities/${encodeURIComponent(selected.slug)}`);
}

export function runDemoAction(action: "reset" | "drift" | "heal"): Promise<unknown> {
  return request(`/api/demo/${action}`, { method: "POST" });
}

export function decideHeal(approve: boolean): Promise<unknown> {
  return request("/api/demo/heal/decision", {
    method: "POST",
    body: JSON.stringify({ approve })
  });
}
