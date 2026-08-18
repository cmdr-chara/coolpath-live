import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));

function migrationVersion(row: unknown): string {
  if (
    typeof row !== "object" ||
    row === null ||
    !("version" in row) ||
    typeof row.version !== "string"
  ) {
    throw new Error("Migration metadata contains an invalid version row");
  }
  return row.version;
}

export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _coolpath_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    sqlite
      .prepare("SELECT version FROM _coolpath_migrations ORDER BY version")
      .all()
      .map(migrationVersion)
  );
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  const apply = sqlite.transaction((version: string, sql: string) => {
    sqlite.exec(sql);
    sqlite
      .prepare("INSERT INTO _coolpath_migrations (version, applied_at) VALUES (?, ?)")
      .run(version, new Date().toISOString());
  });

  for (const version of migrations) {
    if (applied.has(version)) continue;
    const sql = readFileSync(new URL(`../migrations/${version}`, import.meta.url), "utf8");
    apply(version, sql);
  }
}
