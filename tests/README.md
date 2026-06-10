# Postgres-backed test suite

The domain tests run against a real Postgres database so Prisma schema,
manual SQL constraints/triggers, and service-level behavior are verified
together instead of drifting apart.

## Running locally

```sh
pnpm db:up   # start the Postgres container (docker compose)
pnpm test    # run the full suite once
```

`pnpm test:watch` runs Vitest in watch mode.

## How it works

- Tests use a dedicated `nuvasite_test` database inside the same Postgres
  container as development (`docker-compose.yml`), so truncation between
  tests can never touch development data.
- `tests/helpers/global-setup.ts` creates `nuvasite_test` if it does not
  exist and applies the full migration set with `prisma migrate deploy`
  before any suite runs. Every run therefore exercises the same schema a
  fresh production database would have.
- `tests/helpers/db.ts` exports the test Prisma client and
  `resetDatabase()`, which truncates the domain tables (cascading) between
  tests.
- Suites run serially (`fileParallelism: false` in `vitest.config.ts`)
  because they share one database.
- The end-to-end suite additionally creates and drops a scratch database
  (`nuvasite_migration_check`) to prove the migration set applies cleanly to
  a completely fresh database.

## Overriding the database

Set `TEST_DATABASE_URL` to point the suite at a different Postgres server.
The default is
`postgresql://nuvasite:nuvasite@localhost:5432/nuvasite_test?schema=public`.
The user needs permission to create databases (for setup and the fresh-
migration check).
