import { CoolPathRepository } from "@coolpath/db";
import { MockScraperStudioClient } from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import { getConfig } from "../config.js";
import { IngestionService } from "../ingestion-service.js";
import { seedSourceConfiguration } from "../seed.js";

const config = getConfig({ COOLPATH_MODE: "mock" });
const repository = new CoolPathRepository(config.DATABASE_URL);
const client = new MockScraperStudioClient();
const service = new IngestionService(repository, client);

repository.reset();
seedSourceConfiguration(repository);
await service.runSource(DEMO_SOURCE_ID);
client.setLayout("v2");
await service.runSource(DEMO_SOURCE_ID);
await service.requestHeal(DEMO_SOURCE_ID);

process.stdout.write(
  `${JSON.stringify(
    {
      message: "Demo is paused at manual review.",
      sourceId: DEMO_SOURCE_ID,
      incident: repository.getCurrentIncident(DEMO_SOURCE_ID),
      publishedSnapshotProtected:
        repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites.length === 3
    },
    null,
    2
  )}\n`
);
repository.close();
