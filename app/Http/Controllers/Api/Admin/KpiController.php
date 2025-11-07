<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Role;
use App\Models\Lake;
use App\Models\SamplingEvent;

class KpiController extends Controller
{
    /**
     * Consolidated summary endpoint returning all admin KPIs in one round trip.
     * GET /api/admin/kpis/summary
     * Response shape:
     * {
     *   data: {
     *     orgs: { count: int, cached_at: iso8601|null },
     *     users: { count: int, cached_at: iso8601|null },
     *     lakes: { count: int, cached_at: iso8601|null },
     *     events: { count: int, cached_at: iso8601|null }
     *   },
     *   meta: { generated_at: iso8601, cache_ttl_seconds: int, cache_hit: bool }
     * }
     *
     * Caching strategy: per-KPI Redis keys with short TTL (default 120s).
     * If some keys are missing, only those are recomputed; partial cache hit still returns cache_hit=false.
     */
    public function summary(Request $request)
    {
        $ttlSeconds = 120; // adjust if needed later
        $now = now();
        $keys = [
            'kpi:admin:orgs' => function () { return Tenant::query()->count(); },
            'kpi:admin:users' => function () {
                $roles = [Role::PUBLIC, Role::CONTRIBUTOR, Role::ORG_ADMIN];
                $roleIds = Role::query()->whereIn('name', $roles)->pluck('id');
                return User::whereIn('role_id', $roleIds)->count();
            },
            'kpi:admin:lakes' => function () { return Lake::query()->count(); },
            'kpi:admin:events' => function () { return SamplingEvent::query()->count(); },
        ];

        $cacheHitAll = true;
        $results = [];

        foreach ($keys as $redisKey => $resolver) {
            $cached = null;
            $cachedAt = null;
            try {
                $raw = \Illuminate\Support\Facades\Cache::get($redisKey);
                if (is_array($raw) && array_key_exists('count', $raw)) {
                    $cached = (int) $raw['count'];
                    $cachedAt = $raw['ts'] ?? null;
                }
            } catch (\Throwable $e) {
                // ignore cache backend errors; treat as miss
            }

            if ($cached === null) {
                $cacheHitAll = false;
                $start = microtime(true);
                $value = null;
                $error = null;
                try {
                    $value = $resolver();
                } catch (\Throwable $e) {
                    $error = $e->getMessage();
                    $value = 0; // fallback safe default
                }
                $durationMs = (int) ((microtime(true) - $start) * 1000);
                // Store in cache with timestamp
                try {
                    \Illuminate\Support\Facades\Cache::put($redisKey, ['count' => $value, 'ts' => $now->toIso8601String()], $ttlSeconds);
                } catch (\Throwable $e) { /* ignore */ }
                $results[$redisKey] = [
                    'count' => $value,
                    'cached_at' => $now->toIso8601String(),
                    'duration_ms' => $durationMs,
                    'error' => $error,
                ];
            } else {
                $results[$redisKey] = [
                    'count' => $cached,
                    'cached_at' => $cachedAt,
                    'duration_ms' => 0,
                    'error' => null,
                ];
            }
        }

        // Map to response keys
        $resp = [
            'data' => [
                'orgs' => [
                    'count' => $results['kpi:admin:orgs']['count'],
                    'cached_at' => $results['kpi:admin:orgs']['cached_at'],
                ],
                'users' => [
                    'count' => $results['kpi:admin:users']['count'],
                    'cached_at' => $results['kpi:admin:users']['cached_at'],
                ],
                'lakes' => [
                    'count' => $results['kpi:admin:lakes']['count'],
                    'cached_at' => $results['kpi:admin:lakes']['cached_at'],
                ],
                'events' => [
                    'count' => $results['kpi:admin:events']['count'],
                    'cached_at' => $results['kpi:admin:events']['cached_at'],
                ],
            ],
            'meta' => [
                'generated_at' => $now->toIso8601String(),
                'cache_ttl_seconds' => $ttlSeconds,
                'cache_hit' => $cacheHitAll,
            ],
        ];

        return response()->json($resp);
    }
    /**
     * Return total number of organizations (tenants).
     * GET /api/admin/kpis/orgs
     */
    public function orgs(Request $request)
    {
        $total = Tenant::query()->count();
        return response()->json(['count' => $total]);
    }

    /**
     * Return total number of registered users (public, contributor, org_admin).
     * GET /api/admin/kpis/users
     */
    public function users(Request $request)
    {
        $roles = [Role::PUBLIC, Role::CONTRIBUTOR, Role::ORG_ADMIN];
        $roleIds = Role::query()->whereIn('name', $roles)->pluck('id')->toArray();
        $total = User::whereIn('role_id', $roleIds)->count();
        return response()->json(['count' => $total]);
    }

    /**
     * Total number of lakes in the database (lightweight count only).
     * GET /api/admin/kpis/lakes
     */
    public function lakes(Request $request)
    {
        $total = Lake::query()->count();
        return response()->json(['count' => $total]);
    }

    /**
     * Total number of sampling events (all organizations).
     * GET /api/admin/kpis/tests
     */
    public function tests(Request $request)
    {
        $total = SamplingEvent::query()->count();
        return response()->json(['count' => $total]);
    }
}
