# OLIMA AGROCONNECT

Rwanda-focused agricultural marketplace connecting farmers who list produce with buyers who browse and send purchase requests.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — PostgreSQL connection string; Clerk keys are provisioned by Replit Auth setup

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/olima-agroconnect` — responsive marketplace website and role-specific dashboards
- `artifacts/api-server/src/routes/marketplace.ts` — authenticated marketplace API routes
- `lib/api-spec/openapi.yaml` — source of truth for marketplace API contracts
- `lib/db/src/schema/marketplace.ts` — farmer profiles, produce listings, and buyer requests
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — production Clerk frontend API proxy

## Architecture decisions

- Replit-managed Clerk handles account authentication; marketplace roles and contact/profile fields live in PostgreSQL.
- OpenAPI-generated React Query hooks and Zod schemas keep the browser and API contracts aligned.
- Public visitors can browse available listings; creating listings and buyer requests requires a matching signed-in role.

## Product

Visitors can explore featured Rwanda produce, farmers can manage listings and accept or decline incoming requests, and buyers can search listings and track requests they send.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Clerk's `/sign-in/*?` and `/sign-up/*?` routes and production proxy are required for OAuth callback routing; keep the Clerk wiring aligned with its skill reference.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
