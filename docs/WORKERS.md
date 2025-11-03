# Background workers and schedulers

This project uses Laravel's queue system to run background jobs (e.g., raster ingestion). You can run workers locally on Windows and in production (Docker/Supervisor). This guide shows how to configure and operate them.

## TL;DR

- Default queue driver: `database` (jobs stored in DB tables)
- Ingest job queue: `ingest` (IngestPopulationRaster is routed to this queue)
- Local (Windows): `composer run worker:ingest`
- Production (Docker): use `docker/Dockerfile.worker-ingest` and `docker/worker-ingest-start.sh`
- Cron (optional): run `php artisan schedule:run` every minute if you add schedules

## Prerequisites

- DB tables for queues exist: `jobs`, `job_batches`, `failed_jobs`
  - Already provided by migration `database/migrations/0001_01_01_000002_create_jobs_table.php`
- .env contains queue settings. Defaults are safe for DB-backed queues:
  ```env
  QUEUE_CONNECTION=database
  DB_QUEUE_TABLE=jobs
  DB_QUEUE=default
  DB_QUEUE_RETRY_AFTER=90
  ```
- For Redis (optional, recommended at scale):
  ```env
  QUEUE_CONNECTION=redis
  REDIS_URL=redis://:password@host:6379
  REDIS_QUEUE=default
  REDIS_QUEUE_RETRY_AFTER=90
  ```

## Job routing

- The ingestion job (`App/Jobs/IngestPopulationRaster.php`) is routed to the `ingest` queue:
  - Code sets `public $queue = 'ingest';`
  - A worker listening on `ingest` will process these jobs.
- Other jobs (if any) will use the `default` queue unless you route them explicitly.

## Running workers locally (Windows PowerShell)

1) Start your app and DB as usual. Ensure migrations have run.
2) In a PowerShell at `lakeview-ph/`:

```powershell
# General worker for default queue
composer run worker

# Dedicated worker for ingestion queue
composer run worker:ingest
```

These commands run:
- `php artisan queue:work --sleep=3 --tries=1 --timeout=1900` (default queue)
- `php artisan queue:work --queue=ingest --sleep=3 --tries=1 --timeout=1900` (ingest queue)

Tips:
- Use a separate terminal per worker.
- Keep tries=1 for ingest so errors surface fast; use `php artisan queue:retry all` to retry failed jobs.
- For development convenience, `composer run dev` also starts `queue:listen` alongside the dev server.

## Dispatching jobs

Example (already wired for raster ingestion):
- Upload a raster via the admin API, then call the process endpoint:
  - `POST /api/admin/population-rasters` (upload)
  - `POST /api/admin/population-rasters/{id}/process?make_default=true`
- The controller does: `IngestPopulationRaster::dispatch($id, $makeDefault);`
  - The job is queued to `ingest` and will be picked up by the ingest worker.

## Production workers

There are two main options. The repo includes a Docker-based worker image.

### Option A: Docker worker (recommended)

- Use `docker/Dockerfile.worker-ingest` to build a worker-only image. It includes:
  - PHP CLI 8.2, Postgres client, PostGIS raster2pgsql, GDAL
  - Default CMD is `docker/worker-ingest-start.sh`
- Start script (`docker/worker-ingest-start.sh`) runs:
  ```bash
  php artisan queue:work "$CONNECTION" \
    --queue="$QUEUE" \
    --sleep="$WORKER_SLEEP" \
    --tries="$WORKER_TRIES" \
    --timeout="$WORKER_TIMEOUT" \
    --memory="$WORKER_MEMORY_MB"
  ```
- Important env vars for the worker container:
  ```env
  APP_ENV=production
  APP_KEY=base64:...
  DB_CONNECTION=pgsql
  DB_URL=postgresql://USER:PASSWORD@db.example.com:5432/postgres?sslmode=require

  # Queues
  QUEUE_CONNECTION=database   # or redis
  # Queue name to listen on; ingestion worker defaults to 'ingest'
  DB_QUEUE=ingest             # if using database driver
  REDIS_QUEUE=ingest          # if using redis driver

  # Ingestion tooling
  POP_IMPORT_ENABLE_SHELL=true
  POP_RASTER2PGSQL_PATH=/usr/bin/raster2pgsql
  POP_PSQL_PATH=/usr/bin/psql

  # Tuning
  WORKER_MEMORY_MB=3000
  WORKER_TIMEOUT=1900
  WORKER_TRIES=1
  WORKER_SLEEP=3
  ```

- Platform notes:
  - Render: see `docs/DEPLOYMENT.md` for full configuration (Web + Worker + optional Cron).
  - Other PaaS/Kubernetes: run one or more replicas of the worker image with the env above.

### Option B: Supervisor or systemd on a VM

- Install PHP 8.2, required extensions, and Postgres/PostGIS clients.
- Run a long-lived process with Supervisor (example program):
  ```ini
  [program:lakeview-ingest-worker]
  command=php artisan queue:work database --queue=ingest --sleep=3 --tries=1 --timeout=1900
  directory=/var/www/lakeview-ph
  autostart=true
  autorestart=true
  stdout_logfile=/var/log/lakeview/worker.out.log
  stderr_logfile=/var/log/lakeview/worker.err.log
  user=www-data
  stopsignal=QUIT
  ```

## Cron / Scheduler (optional)

If you add scheduled tasks (none by default), run:
- Every minute: `php artisan schedule:run`
- On Render: configure a Cron service with that command.
- On a VM: crontab entry like `* * * * * cd /var/www/lakeview-ph && php artisan schedule:run >> /dev/null 2>&1`

## Troubleshooting

- Job stuck in `jobs` table: ensure a worker is running and connected to the same DB/Redis
- Worker picks up nothing:
  - Check queue name mismatch: job routed to `ingest`, worker must `--queue=ingest`
  - If you prefer the `default` queue, change worker to `--queue=default`
- Timeouts:
  - Increase `WORKER_TIMEOUT` and job `$timeout` together (job has `$timeout=1800`)
  - For Redis, set `REDIS_QUEUE_RETRY_AFTER` > timeout
- Missing tools for ingestion (`raster2pgsql`, `psql`): use the provided worker Docker image; on VMs, install PostGIS tools
- SSL to Postgres: ensure `?sslmode=require` in `DB_URL` or set `PGSSLMODE=require`

## Reference

- Queue config: `config/queue.php`
- Migrations for queue tables: `database/migrations/0001_01_01_000002_create_jobs_table.php`
- Ingest job: `app/Jobs/IngestPopulationRaster.php`
- Ingest controller endpoints: `app/Http/Controllers/Api/Admin/PopulationRasterController.php`
- Docker worker: `docker/Dockerfile.worker-ingest`, `docker/worker-ingest-start.sh`
- Deployment guide: `docs/DEPLOYMENT.md`
