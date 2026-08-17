import { CoolPathRepository } from "@coolpath/db";
import { getConfig } from "../config.js";
import { seedSourceConfiguration } from "../seed.js";

const repository = new CoolPathRepository(getConfig({ COOLPATH_MODE: "mock" }).DATABASE_URL);
repository.reset();
seedSourceConfiguration(repository);
process.stdout.write(
  "CoolPath demo database reset. Start the API to publish the healthy baseline.\n"
);
repository.close();
