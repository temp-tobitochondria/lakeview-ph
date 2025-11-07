# LakeView PH Production Readiness & Performance Checklist

This checklist hardens the application for production, optimizes performance, and reduces risk. Apply all sections; mark items complete in deployment runbooks.

---
## 1. Core Application Flags
- [ ] APP_ENV=production
- [ ] APP_DEBUG=false (never true in prod; prevents stack traces & slows rendering)
- [ ] FORCE_HTTPS=true (behind proxy/load balancer; ensure X-Forwarded-* headers set)
- [ ] APP_KEY is set (already exists)
- [ ] LOG_LEVEL=info (debug only for temporary investigation)

## 2. Security & Secrets Hygiene
- [ ] Rotate APP_KEY only when re-encrypting data; never commit rotations accidentally.
- [ ] Rotate AWS + SMTP + OTP peppers on a calendar schedule or compromise events.
- [ ] Remove any plaintext secrets from build logs.
- [ ] Ensure production .env not checked into repo.
- [ ] Set SESSION_SECURE_COOKIE=true & SAME_SITE=lax/strict as needed.

## 3. Database (Supabase Postgres + PgBouncer Transaction Pool)
- [ ] Use transaction pooler port (6543) in DB_URL.
- [ ] sslmode=require enforced.
- [ ] Add to .env:
```
DB_PGBOUNCER=true
DB_EMULATE_PREPARES=true
DB_PERSISTENT=false
DB_SSLMODE=require
```
- [ ] Confirm slow query logging on Supabase (pg_stat_statements enabled).
- [ ] Create recommended indexes:
  - Audit logs: (tenant_id, event_at DESC), (tenant_id, model_type, event_at DESC)
  - Sampling events: (tenant_id, event_at DESC), (lake_id, event_at DESC)
  - PostGIS: GIST on geometry columns.
- [ ] VACUUM / ANALYZE cadence: rely on Supabase auto-vacuum; review bloat quarterly.

## 4. PHP Runtime / Opcache / FPM
- [ ] Opcache settings (php.ini):
```
opcache.enable=1
opcache.enable_cli=1
opcache.memory_consumption=256
opcache.max_accelerated_files=50000
opcache.validate_timestamps=0
opcache.save_comments=1
```
- [ ] FPM process manager tuned: pm=dynamic or static sized to CPU cores; max_children sized to memory (watch PgBouncer client slot usage).
- [ ] Consider Laravel Octane for lower latency (verify compatibility first).

## 5. Laravel Framework Caches
Run on each deploy (post-migrate):
```
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan optimize
```
If using Octane or memory resident processes, warm caches explicitly.

## 6. Queue & Workers
- [ ] QUEUE_CONNECTION=database (OK) or move to Redis for higher throughput.
- [ ] Run dedicated queue workers (not in web dyno): supervisor or Render background workers.
- [ ] Horizon (if Redis) for monitoring retry spikes.
- [ ] Set retry/backoff strategy: increase WORKER_TRIES for transient errors; add dead-letter.

## 7. Cache & Session Strategy
- [ ] Move CACHE_STORE=file → redis (lower latency, centralized):
```
CACHE_STORE=redis
SESSION_DRIVER=redis
```
- [ ] Configure Redis persistence & retry jitter (already partly configured).
- [ ] Implement application-level caching for: KPI summary, lake/parameter catalogs, audit counts.

## 8. Storage / S3
- [ ] Use signed URLs or managed policies; avoid exposing AWS secret in frontend.
- [ ] Enforce upload size limits & MIME validation.
- [ ] Lifecycle rules for old temporary files.

## 9. HTTP / CDN / Compression
- [ ] Place CDN (Cloudflare/Azure/Render edge) before origin.
- [ ] Enable Brotli + gzip (assets & JSON): server config.
- [ ] Static assets headers:
```
Cache-Control: public, max-age=31536000, immutable
```
- [ ] API cacheable endpoints:
  - KPI summary, reference data: `Cache-Control: public, max-age=60`
  - ETag / Last-Modified for conditional 304.
- [ ] Add generic security headers (via middleware):
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';
```
(Adjust CSP for CDNs, maps, analytics.)

## 10. Frontend Optimization
- [ ] Code splitting & lazy load heavy dashboard pages (ongoing).
- [ ] Tree-shake icons & libraries (analyze bundle). Run: `npm run build --report`.
- [ ] Implement react-query (TanStack) for data deduping + staleTime control.
- [ ] Virtualize large tables (e.g., audit logs > 200 rows) with react-window.
- [ ] Preload critical fonts & above-the-fold CSS.
- [ ] Use `me()` helper (already done) for all user hydration, avoid duplicate auth calls.

## 11. Observability & Instrumentation
- [ ] Server-Timing header: db, cache, view, auth, application.
- [ ] Structured JSON logs (log channel stack → daily rotation or external collector).
- [ ] Web Vitals collection (LCP, INP) send to backend for trend tracking.
- [ ] Alerts on P95 latency threshold & error rate changes.

## 12. Disaster Recovery / Resilience
- [ ] Automated daily DB backups (Supabase handles base; export critical tables monthly).
- [ ] S3 bucket versioning for user uploads (if regulatory requirements). 
- [ ] Run restore drill quarterly.

## 13. Security Hardening
- [ ] Sanctum token rotation policy (long-lived tokens limited to essential scopes).
- [ ] Rate limiting: login, OTP, password reset endpoints.
- [ ] Audit log read endpoints protected by role & tenant scoping (validate indexes for filtering).

## 14. Deployment Workflow
1. Merge → CI run (tests, lint).  
2. Build assets: `npm ci && npm run build`  
3. Run migrations: `php artisan migrate --force`  
4. Warm caches: see Section 5.  
5. Restart workers (queue, Octane).  
6. Smoke test key endpoints (health, KPI, login).  
7. Tag release & record version.

## 15. Post-Deploy Verification
- [ ] P95 latency unchanged or improved.
- [ ] Error rate < baseline threshold.
- [ ] No 500/429 surge.
- [ ] DB connections stable (PgBouncer dashboard).
- [ ] Cache hit ratios acceptable (>60% for hot endpoints).

## 16. Environment Variable Reference (Recommended Final Values)
```
APP_ENV=production
APP_DEBUG=false
LOG_LEVEL=info
DB_CONNECTION=pgsql
DB_URL=postgresql://...:6543/postgres?sslmode=require
DB_SSLMODE=require
DB_PGBOUNCER=true
DB_EMULATE_PREPARES=true
DB_PERSISTENT=false
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=database   # consider redis for high throughput
FORCE_HTTPS=true
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
RUN_QUEUE_IN_WEB=false
```

## 17. Future Enhancements
- Switch to Redis queue + Horizon.
- Migrate heavy aggregations to materialized views refreshed periodically.
- Adopt Octane + RoadRunner for sustained concurrency.
- Implement background prewarm tasks for high-frequency caches.

---
Keep this file updated; add timestamps when items validated.
