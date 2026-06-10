/**
 * Tests run against a dedicated database in the same Postgres container as
 * development so test truncation can never touch development data.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://nuvasite:nuvasite@localhost:5432/nuvasite_test?schema=public";
