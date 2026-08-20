import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const collectorId = "c_msxe8lsm2630ya30wu";
const sourceId = "pa211-philadelphia-cooling";
const sourceOrigin = "https://search.pa211.org";
const allowedClassifications = new Set([
  "live_captured_and_sanitized",
  "deterministic_fixture",
  "illustrative_command_output"
]);

const requiredFiles = [
  "docs/judging-matrix.md",
  "docs/bright-data-reproduction.md",
  "docs/video-runbook.md",
  "docs/submission-copy.md",
  "docs/evidence/bright-data.md",
  "docs/evidence/scraper-studio-output.example.json",
  "docs/evidence/live-api-publication.example.json",
  "docs/evidence/healing-recovery.example.json",
  "docs/evidence/drift-quarantine.example.json"
];

const failures = [];

function fail(message) {
  failures.push(message);
}

async function readText(path) {
  return readFile(resolve(root, path), "utf8");
}

async function readJson(path) {
  try {
    return JSON.parse(await readText(path));
  } catch (error) {
    fail(`${path}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function expectEqual(path, actual, expected) {
  if (actual !== expected) {
    fail(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectNonNegativeInteger(path, value) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${path}: expected a non-negative integer, got ${JSON.stringify(value)}`);
  }
}

function verifyClassification(path, artifact) {
  if (!allowedClassifications.has(artifact?.evidenceClassification)) {
    fail(`${path}: unsupported or missing evidenceClassification`);
  }
}

function verifyCoverage(path, coverage) {
  if (!coverage || typeof coverage !== "object") {
    fail(`${path}: missing coverage object`);
    return;
  }
  const keys = [
    "providerRecordsReceived",
    "normalizedRecordsAccepted",
    "recordsFilteredNotLocations",
    "exactDuplicatesRemoved"
  ];
  for (const key of keys) expectNonNegativeInteger(`${path}.coverage.${key}`, coverage[key]);
  const sourceRejected = coverage.recordsRejectedBySourceValidation ?? 0;
  const validationRejected = coverage.recordsRejectedByValidation ?? sourceRejected;
  expectNonNegativeInteger(`${path}.coverage.recordsRejectedBySourceValidation`, sourceRejected);
  expectNonNegativeInteger(`${path}.coverage.recordsRejectedByValidation`, validationRejected);

  if (
    Number.isInteger(coverage.providerRecordsReceived) &&
    Number.isInteger(coverage.normalizedRecordsAccepted) &&
    Number.isInteger(coverage.recordsFilteredNotLocations) &&
    Number.isInteger(coverage.exactDuplicatesRemoved) &&
    Number.isInteger(sourceRejected)
  ) {
    const accounted =
      coverage.normalizedRecordsAccepted +
      coverage.recordsFilteredNotLocations +
      coverage.exactDuplicatesRemoved +
      sourceRejected;
    if (accounted !== coverage.providerRecordsReceived) {
      fail(
        `${path}: source normalization does not account for every provider row ` +
          `(${accounted} != ${coverage.providerRecordsReceived})`
      );
    }
  }
}

function walkStrings(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) value.forEach((entry) => walkStrings(entry, visit));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => walkStrings(entry, visit));
  }
}

function verifyNoSecretValues(path, artifact) {
  walkStrings(artifact, (value) => {
    if (/authorization:\s*bearer\s+(?!\$\{|<)/i.test(value)) {
      fail(`${path}: contains a literal bearer credential`);
    }
    if (/\b(?:api[_-]?token|operator[_-]?token)\s*[=:]\s*(?!<|\$\{)/i.test(value)) {
      fail(`${path}: contains a literal token assignment`);
    }
  });
}

const forbiddenPayloadKeys = new Set([
  "authorization",
  "authorizationHeader",
  "authorizationHeaders",
  "cookie",
  "cookies",
  "rawProviderPayload",
  "rawProviderRecords",
  "rawRejectedRecords",
  "rawRejectedRows",
  "rejectedRecords",
  "rejectedRows",
  "quarantinedRecords"
]);

function verifyNoSensitivePayloadKeys(path, value, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      verifyNoSensitivePayloadKeys(path, entry, [...trail, String(index)])
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    const nextTrail = [...trail, key];
    if (forbiddenPayloadKeys.has(key)) {
      fail(`${path}.${nextTrail.join(".")}: forbidden raw or sensitive payload key`);
    }
    verifyNoSensitivePayloadKeys(path, entry, nextTrail);
  }
}

function verifyArtifactSafety(path, artifact) {
  verifyClassification(path, artifact);
  verifyNoSecretValues(path, artifact);
  verifyNoSensitivePayloadKeys(path, artifact);
}

for (const path of requiredFiles) {
  try {
    const info = await stat(resolve(root, path));
    if (!info.isFile()) fail(`${path}: required path is not a file`);
  } catch {
    fail(`${path}: required file is missing`);
  }
}

const scraperOutputPath = "docs/evidence/scraper-studio-output.example.json";
const scraperOutput = await readJson(scraperOutputPath);
if (scraperOutput) {
  verifyArtifactSafety(scraperOutputPath, scraperOutput);
  expectEqual(`${scraperOutputPath}.collectorId`, scraperOutput.collectorId, collectorId);
  expectEqual(`${scraperOutputPath}.sourceId`, scraperOutput.sourceId, sourceId);
  expectEqual(`${scraperOutputPath}.mode`, scraperOutput.mode, "real");
  expectEqual(
    `${scraperOutputPath}.sourceTarget.origin`,
    scraperOutput.sourceTarget?.origin,
    sourceOrigin
  );
  expectEqual(
    `${scraperOutputPath}.sourceTarget.governmentWebsite`,
    scraperOutput.sourceTarget?.governmentWebsite,
    false
  );
  const expectedFields = ["facility_name", "address", "service_text", "evidence_url"];
  expectEqual(
    `${scraperOutputPath}.fields`,
    JSON.stringify(scraperOutput.fields),
    JSON.stringify(expectedFields)
  );
  verifyCoverage(scraperOutputPath, scraperOutput.coverage);
  const sampleRecords = scraperOutput.sampleRecords ?? [];
  if (!Array.isArray(sampleRecords) || sampleRecords.length === 0) {
    fail(`${scraperOutputPath}: expected at least one sanitized sample record`);
  }
  for (const [index, record] of sampleRecords.entries()) {
    expectEqual(
      `${scraperOutputPath}.sampleRecords[${index}].fields`,
      JSON.stringify(Object.keys(record).sort()),
      JSON.stringify([...expectedFields].sort())
    );
    try {
      const evidenceUrl = new URL(record.evidence_url);
      expectEqual(
        `${scraperOutputPath}.sampleRecords[${index}].origin`,
        evidenceUrl.origin,
        sourceOrigin
      );
      expectEqual(
        `${scraperOutputPath}.sampleRecords[${index}].protocol`,
        evidenceUrl.protocol,
        "https:"
      );
    } catch {
      fail(`${scraperOutputPath}.sampleRecords[${index}]: invalid evidence_url`);
    }
  }
}

const publicationPath = "docs/evidence/live-api-publication.example.json";
const publication = await readJson(publicationPath);
if (publication) {
  verifyArtifactSafety(publicationPath, publication);
  expectEqual(
    `${publicationPath}.operatorCheck.collectorId`,
    publication.operatorCheck?.collectorId,
    collectorId
  );
  expectEqual(
    `${publicationPath}.operatorCheck.sourceId`,
    publication.operatorCheck?.sourceId,
    sourceId
  );
  expectEqual(
    `${publicationPath}.candidate.workingTreeClean`,
    typeof publication.candidate?.workingTreeClean,
    "boolean"
  );
  expectEqual(
    `${publicationPath}.candidate.exactFinalCommit`,
    typeof publication.candidate?.exactFinalCommit,
    "boolean"
  );
  if (
    publication.candidate?.exactFinalCommit === true &&
    publication.candidate?.workingTreeClean !== true
  ) {
    fail(`${publicationPath}: exact-final-commit evidence must come from a clean worktree`);
  }
  verifyCoverage(publicationPath, publication.operatorCheck?.coverage);
  expectNonNegativeInteger(
    `${publicationPath}.afterCollection.publishedSiteCount`,
    publication.afterCollection?.publishedSiteCount
  );
  expectEqual(
    `${publicationPath}.afterCollection.activeIncident`,
    publication.afterCollection?.activeIncident,
    false
  );
  if (
    publication.afterCollection?.publishedSiteCount >
    publication.operatorCheck?.coverage?.normalizedRecordsAccepted
  ) {
    fail(`${publicationPath}: published count exceeds normalized accepted count`);
  }
}

const healingPath = "docs/evidence/healing-recovery.example.json";
const healing = await readJson(healingPath);
if (healing) {
  verifyArtifactSafety(healingPath, healing);
  expectEqual(`${healingPath}.collectorIdBefore`, healing.collectorIdBefore, collectorId);
  expectEqual(`${healingPath}.collectorIdAfter`, healing.collectorIdAfter, collectorId);
  expectEqual(`${healingPath}.sourceId`, healing.sourceId, sourceId);
  expectEqual(`${healingPath}.controlledSimulation`, healing.controlledSimulation, false);
  expectEqual(`${healingPath}.target.origin`, healing.target?.origin, sourceOrigin);
  expectEqual(`${healingPath}.target.governmentWebsite`, healing.target?.governmentWebsite, false);
  expectEqual(
    `${healingPath}.repairRequest.manualApprovalRequired`,
    healing.repairRequest?.manualApprovalRequired,
    true
  );
  expectEqual(
    `${healingPath}.repairRequest.autoApprovalUsed`,
    healing.repairRequest?.autoApprovalUsed,
    false
  );
  expectEqual(`${healingPath}.firstPreview.decision`, healing.firstPreview?.decision, "rejected");
  expectEqual(`${healingPath}.secondPreview.decision`, healing.secondPreview?.decision, "approved");
  verifyCoverage(healingPath, healing.postHealRerun?.coverage);
}

const driftPath = "docs/evidence/drift-quarantine.example.json";
const drift = await readJson(driftPath);
if (drift) {
  verifyArtifactSafety(driftPath, drift);
  expectEqual(`${driftPath}.controlledSimulation`, drift.controlledSimulation, true);
  expectEqual(
    `${driftPath}.evidenceClassification`,
    drift.evidenceClassification,
    "deterministic_fixture"
  );
  verifyCoverage(`${driftPath}.baseline`, drift.baseline?.coverage);
  verifyCoverage(`${driftPath}.drift`, drift.drift?.coverage);
  verifyCoverage(`${driftPath}.recovery`, drift.recovery?.coverage);
  expectEqual(
    `${driftPath}.drift.candidateSnapshotStatus`,
    drift.drift?.candidateSnapshotStatus,
    "quarantined"
  );
  expectEqual(
    `${driftPath}.drift.publishedRecordsRetained`,
    drift.drift?.publishedRecordsRetained,
    drift.baseline?.publishedRecords
  );
  expectEqual(
    `${driftPath}.drift.publicDirectoryConsumedInvalidCandidate`,
    drift.drift?.publicDirectoryConsumedInvalidCandidate,
    false
  );
  expectEqual(
    `${driftPath}.healingPreview.manualApprovalRequired`,
    drift.healingPreview?.manualApprovalRequired,
    true
  );
  expectEqual(`${driftPath}.recovery.sameCollectorId`, drift.recovery?.sameCollectorId, true);
}

const reproduction = await readText("docs/bright-data-reproduction.md");
for (const command of [
  "npx -p @brightdata/cli bdata scraper run",
  "npx -p @brightdata/cli bdata scraper heal",
  "npx -p @brightdata/cli bdata scraper approve"
]) {
  if (!reproduction.includes(command)) {
    fail(`docs/bright-data-reproduction.md: missing ${command}`);
  }
}
if (reproduction.includes("--auto-approve")) {
  fail("docs/bright-data-reproduction.md: jury workflow must not use automatic approval");
}
if (!reproduction.includes("Retrieved: 2026-08-20")) {
  fail("docs/bright-data-reproduction.md: missing official-source retrieval date");
}

const submissionCopy = await readText("docs/submission-copy.md");
for (const stalePhrase of [
  "add after the final real rerun",
  "Genuine Bright Data healing evidence should be claimed only if"
]) {
  if (submissionCopy.includes(stalePhrase)) {
    fail(`docs/submission-copy.md: stale claim remains: ${stalePhrase}`);
  }
}

if (failures.length > 0) {
  console.error("Submission evidence verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Submission evidence verification passed.");
  console.log(`Collector: ${collectorId}`);
  console.log(`Source: ${sourceId}`);
  console.log("Evidence classes: live sanitized, deterministic fixture, illustrative commands.");
}
