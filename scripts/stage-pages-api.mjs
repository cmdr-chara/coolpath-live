import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiCityResponseEnvelopeSchema,
  apiCitySummaryListEnvelopeSchema
} from "../packages/domain/dist/api-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "apps", "web", "dist");
const evidence = path.join(root, "docs", "evidence");

const cities = apiCitySummaryListEnvelopeSchema.parse(
  JSON.parse(await readFile(path.join(evidence, "deployed-city-list.example.json"), "utf8"))
);
const city = apiCityResponseEnvelopeSchema.parse(
  JSON.parse(await readFile(path.join(evidence, "deployed-public-read-model.example.json"), "utf8"))
);

if (city.data.source.status !== "STALE" || city.data.snapshot?.sites.length !== 23) {
  throw new Error("Pages may publish only the labelled 23-record historical read model");
}

await writeJson(path.join(dist, "api", "cities.json"), cities);
await writeJson(path.join(dist, "api", "cities", "philadelphia.json"), city);
await writeFile(path.join(dist, ".nojekyll"), "", "utf8");
console.log("Staged the contract-validated, read-only API snapshot for GitHub Pages.");

async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
