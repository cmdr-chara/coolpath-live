import { buildApp } from "./app.js";
import { getConfig } from "./config.js";

const config = getConfig();
const app = await buildApp({ config });
let closing = false;

async function shutdown(signal: "SIGINT" | "SIGTERM" | "listen_error"): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "shutting down API");
  try {
    await app.close();
  } catch (error) {
    app.log.error({ err: error, signal }, "API shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error({ err: error }, "API failed to start");
  process.exitCode = 1;
  await shutdown("listen_error");
}
