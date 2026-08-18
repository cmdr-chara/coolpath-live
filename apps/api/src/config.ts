import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const envBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off", ""].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().default("./data/coolpath.db"),
  COOLPATH_MODE: z.enum(["mock", "real"]).default("mock"),
  AUTO_START_REAL_CHECK: envBoolean.default(false),
  BRIGHT_DATA_API_TOKEN: z.string().optional(),
  OPERATOR_API_TOKEN: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(32).optional()
  ),
  BRIGHT_DATA_API_BASE_URL: z
    .url()
    .refine((value) => new URL(value).protocol === "https:", "Bright Data API URL must use HTTPS")
    .default("https://api.brightdata.com"),
  BRIGHT_DATA_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  BRIGHT_DATA_POLL_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  PRIMARY_COLLECTOR_ID: z.string().optional(),
  WEB_ORIGIN: z.string().default("http://localhost:5173")
});

export type AppConfig = z.infer<typeof envSchema>;

export function getConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return envSchema.parse({ ...process.env, ...overrides });
}
