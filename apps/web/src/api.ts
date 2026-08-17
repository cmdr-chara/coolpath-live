import type { ApiEnvelope, CityResponse, Incident } from "./types";

const baseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.data;
}

export function getCity(): Promise<CityResponse> {
  return request<CityResponse>("/api/cities/demo-city");
}

export function getIncident(sourceId: string): Promise<Incident | null> {
  return request<Incident | null>(`/api/incidents/${encodeURIComponent(sourceId)}/current`);
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
