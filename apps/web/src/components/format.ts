export function formatInstant(value: string | undefined, timeZone: string): string {
  if (!value) return "Not yet verified";
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(new Date(value))} (${timeZone})`;
}

export function formatPercent(value: number | undefined): string {
  return value === undefined ? "Not available" : `${Math.round(value * 100)}%`;
}

export function formatState(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function sourceHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
