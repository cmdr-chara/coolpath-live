import { buildApp } from "./app.js";
import { getConfig } from "./config.js";

const config = getConfig();
const app = await buildApp({ config });

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
