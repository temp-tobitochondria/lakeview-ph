<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Lake;
use App\Models\Watershed;
use App\Models\WaterQualityClass;
use App\Models\Parameter;
use App\Models\WqStandard;
use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class OptionsController extends Controller
{
    /**
     * GET /api/options/roles
     * Returns ["public", "contributor", ...] for role dropdowns.
     */
    public function roles(Request $request)
    {
        // Optionally filter by scope if needed
        $roles = \App\Models\Role::query()
            ->orderBy('id')
            ->pluck('name')
            ->values();
        return response()->json($roles);
    }
    /**
     * GET /api/options/lakes?q=&limit=
     * Returns [{ id, name, class_code }, ...] for lightweight dropdowns.
     */
    public function lakes(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 500);
        $limit = max(1, min($limit, 2000)); // cap for safety

        $rows = Lake::query()
            ->select(['id', 'name', 'class_code'])
            ->when($q !== '', function ($qb) use ($q) {
                // Postgres: ILIKE for case-insensitive search
                $qb->where('name', 'ILIKE', "%{$q}%");
            })
            ->orderBy('name')
            ->limit($limit)
            ->get();

        return response()->json($rows);
    }

    /**
     * GET /api/options/watersheds?q=&limit=
     * Returns [{ id, name }, ...] for lightweight dropdowns.
     */
    public function watersheds(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 500);
        $limit = max(1, min($limit, 2000));

        $rows = Watershed::query()
            ->select(['id', 'name'])
            ->when($q !== '', function ($qb) use ($q) {
                $qb->where('name', 'ILIKE', "%{$q}%");
            })
            ->orderBy('name')
            ->limit($limit)
            ->get();

        return response()->json($rows);
    }

    /**
     * GET /api/options/parameters?q=&limit=
     * Returns lightweight parameter records for dropdowns.
     */
    public function parameters(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 500);
        $limit = max(1, min($limit, 2000));

        $rows = Parameter::query()
            ->select(['id', 'code', 'name', 'unit', 'evaluation_type', 'desc'])
            ->when($q !== '', function ($qb) use ($q) {
                $like = "%{$q}%";
                $qb->where(function ($inner) use ($like) {
                    $inner->where('code', 'ILIKE', $like)
                        ->orWhere('name', 'ILIKE', $like);
                });
            })
            ->orderBy('code')
            ->limit($limit)
            ->get();

        return response()->json($rows);
    }

    /**
     * GET /api/options/wq-standards
     * Returns available standards ordered by current then code.
     */
    public function standards()
    {
        $rows = WqStandard::query()
            ->select(['id', 'code', 'name', 'is_current'])
            ->orderByDesc('is_current')
            ->orderBy('code')
            ->get();

        return response()->json($rows);
    }

    /**
     * GET /api/options/water-quality-classes
     * Returns [{ code, name }, ...] ordered by code.
     */
    public function waterQualityClasses()
    {
        $key = 'options:wq-classes:v2';
        if ($hit = Cache::get($key)) return response()->json($hit);
        $rows = WaterQualityClass::query()
            ->select(['code', 'name'])
            ->orderBy('code')
            ->get();
        Cache::put($key, $rows, now()->addDays(7));
        return response()->json($rows);
    }

    /**
     * GET /api/options/regions
     * Returns distinct region names from lakes
     */
    public function regions()
    {
        $rows = Lake::query()
            ->selectRaw('distinct region')
            ->whereNotNull('region')
            ->orderBy('region')
            ->pluck('region')
            ->filter()
            ->values();

        return response()->json($rows);
    }

    /**
     * GET /api/options/provinces
     * Returns distinct province names from lakes
     */
    public function provinces()
    {
        $rows = Lake::query()
            ->selectRaw('distinct province')
            ->whereNotNull('province')
            ->orderBy('province')
            ->pluck('province')
            ->filter()
            ->values();

        return response()->json($rows);
    }

    /**
     * GET /api/options/municipalities
     * Returns distinct municipality names from lakes
     */
    public function municipalities()
    {
        $rows = Lake::query()
            ->selectRaw('distinct municipality')
            ->whereNotNull('municipality')
            ->orderBy('municipality')
            ->pluck('municipality')
            ->filter()
            ->values();

        return response()->json($rows);
    }

    /**
     * GET /api/options/tenants?q=&limit=
     * Lightweight list of active tenants for dropdowns. Returns { data: [{ id, name }, ...] }
     */
    public function tenants(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 1000);
        $limit = max(1, min($limit, 5000));

        try {
            $rows = Tenant::query()
                ->select(['id', 'name'])
                ->where('active', true)
                ->when($q !== '', function ($qb) use ($q) {
                    $qb->where('name', 'ILIKE', "%{$q}%");
                })
                ->orderBy('name')
                ->limit($limit)
                ->get();

            return response()->json(['data' => $rows]);
        } catch (\Throwable $e) {
            // Fallback to raw SQL to surface clearer DB errors and keep dropdowns working
            try {
                $sql = 'select id, name from tenants where active = true';
                $params = [];
                if ($q !== '') { $sql .= ' and name ILIKE ?'; $params[] = "%{$q}%"; }
                $sql .= ' order by name limit ?';
                $params[] = $limit;
                $rows = DB::select($sql, $params);
                // Mark response as fallback for observability
                return response()->json(['data' => $rows, 'fallback' => 'raw']);
            } catch (\Throwable $e2) {
                \Log::error('options.tenants failed', [
                    'eloquent_error' => $e->getMessage(),
                    'raw_error' => $e2->getMessage(),
                ]);
                return response()->json([
                    'error' => 'Failed to list tenants',
                    'eloquent' => $e->getMessage(),
                    'raw' => $e2->getMessage(),
                ], 500);
            }
        }
    }
}
