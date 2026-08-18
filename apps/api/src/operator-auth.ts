import { timingSafeEqual } from "node:crypto";

export function requireConfigured(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required in real mode`);
  return value;
}

export function validBearerToken(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const target = Buffer.from(expected, "utf8");
  return supplied.length === target.length && timingSafeEqual(supplied, target);
}
