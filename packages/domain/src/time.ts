export interface ZonedTimestamp {
  instant: string;
  timeZone: string;
  localIso: string;
  utcOffset: string;
}

export function formatInstantInTimeZone(value: string | Date, timeZone: string): ZonedTimestamp {
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid timestamp");

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset"
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const required = ["year", "month", "day", "hour", "minute", "second", "timeZoneName"];
  if (required.some((part) => !parts[part])) {
    throw new Error("Could not format timestamp in the requested timezone");
  }
  const utcOffset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName?.slice(3);
  if (!utcOffset || !/^[+-]\d{2}:\d{2}$/.test(utcOffset)) {
    throw new Error("Could not determine timezone offset");
  }

  return {
    instant: instant.toISOString(),
    timeZone,
    localIso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${utcOffset}`,
    utcOffset
  };
}
