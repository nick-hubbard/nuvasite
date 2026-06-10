import { execSync } from "node:child_process";

import { Client } from "pg";

import { TEST_DATABASE_URL } from "./test-database-url";

/**
 * Creates the dedicated test database if it does not exist yet, then applies
 * the full migration set so tests always run against the schema a fresh
 * production database would have.
 */
export default async function globalSetup() {
  const testUrl = new URL(TEST_DATABASE_URL);
  const testDbName = testUrl.pathname.slice(1);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [testDbName],
    );
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${testDbName}"`);
    }
  } finally {
    await admin.end();
  }

  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
