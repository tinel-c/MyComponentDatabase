# MyComponentDatabase

Web application to **register and track parts and components** for a hobby warehouse (electronics, mechanical stock, tools, and related items).

**GitHub:** [github.com/tinel-c/MyComponentDatabase](https://github.com/tinel-c/MyComponentDatabase)

## Documentation

- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — researched features, technology choices, data model outline, and phased implementation steps.

## Application code

The Next.js app lives in **`web/`**.

### Setup

1. Copy `web/.env.example` to `web/.env` (defaults to SQLite `file:./dev.db`).
2. Install dependencies and apply migrations:

```bash
cd web
npm install
npx prisma migrate dev
```

3. Optional sample data:

```bash
npx prisma db seed
```

4. Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Parts**, **Categories**, and **Locations** in the header to manage inventory.

PostgreSQL is optional: use `docker compose up -d` from the repo root, then point `DATABASE_URL` at Postgres and set `provider = "postgresql"` in `web/prisma/schema.prisma` before running migrations.

## License

Specify a license in the repository when you publish (e.g. MIT) if you want others to reuse the code.
