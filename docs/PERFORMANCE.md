# Performance

This document summarizes the runtime performance strategy across backend, database, frontend, and delivery. For a full production checklist, see `docs/PRODUCTION_CHECKLIST.md`.

## Production hardening and tuning (quick checklist)

- App flags: `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=info`, `FORCE_HTTPS=true`.
- Database: use Supabase transaction pooler (port 6543), `sslmode=require`.
  - .env: `DB_PGBOUNCER=true`, `DB_EMULATE_PREPARES=true`, `DB_PERSISTENT=false`.
  - Enable `pg_stat_statements`; index hot filters `(tenant_id, event_at, lake_id, model_type)`.
- PHP/Laravel: enable Opcache; run artisan caches on deploy (config/route/view/event/optimize).
- Caching: Redis for cache/session/queue (or start with database queue); short TTLs for KPI/reference endpoints.
- HTTP: enable Brotli/gzip; static assets immutable cache; API conditional GET (ETag/Last-Modified).
- Frontend: lazy-load heavy routes, dedupe queries (react-query), virtualize long tables.
- Observability: Server-Timing for db/cache/view; collect Web Vitals; alert on P95 regressions.

## Backend specifics

- Consolidate KPI calls; use per-tenant cache with 15–60s TTL.
- Avoid N+1; eager-load needed relationships and `select([...])` only necessary columns.
- Use queue for slow tasks (email, file processing, exports). Prefer Redis + Horizon for scale.
- Consider Octane (Swoole/RoadRunner) after ensuring stateless code and compatibility.

## Database specifics

- Indexes (examples):
  - Audit logs: `(tenant_id, event_at DESC)`, `(tenant_id, model_type, event_at DESC)`.
  - Sampling events: `(tenant_id, event_at DESC)`, `(lake_id, event_at DESC)`.
  - PostGIS: GIST on geometry columns used in filters.
- Turn on `pg_stat_statements` and a slow query log (>=200ms) to find hotspots.
- Rely on Supabase autovacuum; review bloat quarterly.

## Frontend specifics

- Centralize user hydration via a single `me()` helper with TTL + in-flight dedup (done).
- Adopt React Query (TanStack) for cache, staleTime, and request deduplication.
- Code-split routes; prefetch likely-next chunks on idle/hover.
- Virtualize long tables to reduce DOM nodes.
- Bundle hygiene: remove unused icons/utilities; analyze with `vite --stats` or a plugin.

## Delivery & edge

- Place a CDN in front; enable HTTP/2 or HTTP/3 and Brotli.
- Serve static assets with `Cache-Control: public, max-age=31536000, immutable`.
- Add ETag/Last-Modified for cacheable API responses.

## Observability

- Add `Server-Timing` metrics per endpoint: `db`, `cache`, `view`, `auth`, `app`.
- Track Web Vitals in production; alert on P95 latency regression.

