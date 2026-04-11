# MyComponentDatabase

Web application to **register and track parts and components** for a hobby warehouse (electronics, mechanical stock, tools, and related items).

**GitHub:** [github.com/tinel-c/MyComponentDatabase](https://github.com/tinel-c/MyComponentDatabase)

## Documentation

- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — researched features, technology choices, data model outline, and phased implementation steps.

## Application code

The Next.js app lives in **`web/`**.

### Setup

1. Copy `web/.env.example` to `web/.env` and fill in values (see **Authentication** below).
2. Install dependencies (Next.js 16 may need `npm install --legacy-peer-deps` if npm reports peer conflicts):

```bash
cd web
npm install
npx prisma migrate dev
```

3. Seed optional demo data **and** the first admin user (email from `ADMIN_EMAIL` in `.env`):

```bash
npx prisma db seed
```

4. Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in from **Sign in** on the home page.

### Authentication (Google)

- Create an OAuth **Web application** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and set **Authorized redirect URI** to  
  `{AUTH_URL}/api/auth/callback/google` (e.g. `http://localhost:3000/api/auth/callback/google`).
- Put the client ID and secret in `.env` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- Set `AUTH_SECRET` to a long random string (e.g. `openssl rand -base64 32`).
- Set `AUTH_URL` to your app’s public origin (local: `http://localhost:3000`).
- **Invite-only sign-in:** the Google account matching **`ADMIN_EMAIL`** in `web/.env` (default `tinel.c@gmail.com`) is **auto-created as admin** on first sign-in if missing. Other emails must be added under **Team** by an admin (or run `npx prisma db seed`, which also ensures the admin user exists).

### Roles

- **Admin:** full CRUD on categories and locations; **Team** page to create users and assign **visible categories** (members see those categories and all subcategories).
- **Member:** sees only parts whose **category** falls under assigned categories; categories/locations are read-only (locations shown for reference).

PostgreSQL is optional: use `docker compose up -d` from the repo root, then point `DATABASE_URL` at Postgres and set `provider = "postgresql"` in `web/prisma/schema.prisma` before running migrations.

## License

Specify a license in the repository when you publish (e.g. MIT) if you want others to reuse the code.
