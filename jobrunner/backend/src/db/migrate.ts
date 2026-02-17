/**
 * Database migration runner.
 * Applies numbered SQL migration files in order, tracking which have been applied.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, initDb } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export function runMigrations(): void {
  // Ensure the base database and _migrations table exist
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  // Get list of migration files, sorted
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  // Get already applied migrations
  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[])
      .map(r => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    console.log(`[migrate] Applying ${file}...`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

    db.exec(sql);
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      file,
      new Date().toISOString()
    );

    console.log(`[migrate] Applied ${file}`);
  }

  console.log("[migrate] All migrations applied");
}

// Run directly when called as a script
const isMainModule = process.argv[1]?.endsWith("migrate.ts") ||
                     process.argv[1]?.endsWith("migrate.js");

if (isMainModule) {
  // Initialize the base db first
  initDb();
  runMigrations();
  console.log("[migrate] Done");
}
