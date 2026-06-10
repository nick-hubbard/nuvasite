# Nuvasite

Standalone Next.js app for the Nuvasite portal.

## Development

Install dependencies:

```sh
pnpm install
```

Copy the local environment template:

```sh
cp .env.example .env
```

Start the local PostgreSQL database:

```sh
pnpm db:up
```

Generate Prisma Client:

```sh
pnpm prisma:generate
```

Start the dev server:

```sh
pnpm dev
```

Build for production:

```sh
pnpm build
```

Run checks:

```sh
pnpm lint
pnpm check-types
```

Useful database commands:

```sh
pnpm db:migrate
pnpm db:push
pnpm db:studio
pnpm db:down
```
