import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./db";

const migrationsDirectory = path.resolve(process.cwd(), "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "_app_migrations" (
      "filename" text PRIMARY KEY NOT NULL,
      "applied_at" timestamp DEFAULT now() NOT NULL
    )
  `);
}

async function hasMigrationRun(filename: string) {
  const result = await pool.query(
    `SELECT 1 FROM "_app_migrations" WHERE "filename" = $1 LIMIT 1`,
    [filename],
  );
  return result.rowCount > 0;
}

async function applyMigration(filename: string) {
  const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      `INSERT INTO "_app_migrations" ("filename") VALUES ($1) ON CONFLICT ("filename") DO NOTHING`,
      [filename],
    );
    await client.query("COMMIT");
    console.log(`[migrate] applied ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function migrate() {
  await ensureMigrationsTable();
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of migrationFiles) {
    if (await hasMigrationRun(filename)) {
      console.log(`[migrate] skipped ${filename}`);
      continue;
    }

    await applyMigration(filename);
  }
}

migrate()
  .then(async () => {
    await pool.end();
    console.log("[migrate] complete");
  })
  .catch(async (error) => {
    console.error("[migrate] failed", error);
    await pool.end();
    process.exit(1);
  });
