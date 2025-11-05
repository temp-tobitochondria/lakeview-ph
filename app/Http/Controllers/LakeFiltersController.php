<?php

namespace App\Http\Controllers;

use App\Models\Lake;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class LakeFiltersController extends Controller
{
    /**
     * Return facet options for lakes based on current filters.
     * Query params: region?, province?, municipality?, class_code?
     * Response: { regions: [{value,count}], provinces: [...], municipalities: [...], classes: [{code,name,count}] }
     */
    public function index(Request $request)
    {
        $region = trim((string) $request->query('region', '')) ?: null;
        $province = trim((string) $request->query('province', '')) ?: null;
        $municipality = trim((string) $request->query('municipality', '')) ?: null;
        $classCode = trim((string) $request->query('class_code', '')) ?: null;

        $keyParts = [
            'filters:lakes',
            'r=' . ($region ?? ''),
            'p=' . ($province ?? ''),
            'm=' . ($municipality ?? ''),
            'c=' . ($classCode ?? ''),
        ];
        $cacheKey = implode(':', $keyParts);

        // Cache for 30 minutes; these change rarely and are cheap to invalidate on writes if needed.
        $payload = Cache::remember($cacheKey, now()->addMinutes(30), function () use ($region, $province, $municipality, $classCode) {
            $driver = DB::getDriverName();
            try {
                if ($driver === 'pgsql') {
                    return $this->pgFacets($region, $province, $municipality, $classCode);
                }
                if (in_array($driver, ['mysql', 'mariadb'])) {
                    return $this->mysqlFacets($region, $province, $municipality, $classCode);
                }
            } catch (\Throwable $e) {
                // fall back to portable if DB-specific path fails
            }

            // Portable: use Eloquent to get minimal arrays (no counts, less efficient but portable for dev/test)
            $q = Lake::query();
            if ($region) $q->where('region', 'like', '%"' . addcslashes($region, '"') . '"%');
            if ($province) $q->where('province', 'like', '%"' . addcslashes($province, '"') . '"%');
            if ($municipality) $q->where('municipality', 'like', '%"' . addcslashes($municipality, '"') . '"%');
            if ($classCode) $q->where('class_code', $classCode);
            $rows = $q->select(['region','province','municipality','class_code'])->get();
            $regions = [];$provinces=[];$municipalities=[];$classes=[];
            foreach ($rows as $r) {
                foreach ((array) $r->region as $v) { $v = trim((string)$v); if ($v !== '') $regions[$v] = ($regions[$v] ?? 0) + 1; }
                foreach ((array) $r->province as $v) { $v = trim((string)$v); if ($v !== '') $provinces[$v] = ($provinces[$v] ?? 0) + 1; }
                foreach ((array) $r->municipality as $v) { $v = trim((string)$v); if ($v !== '') $municipalities[$v] = ($municipalities[$v] ?? 0) + 1; }
                if ($r->class_code) $classes[$r->class_code] = ($classes[$r->class_code] ?? 0) + 1;
            }
            ksort($regions, SORT_NATURAL|SORT_FLAG_CASE);
            ksort($provinces, SORT_NATURAL|SORT_FLAG_CASE);
            ksort($municipalities, SORT_NATURAL|SORT_FLAG_CASE);
            ksort($classes, SORT_NATURAL|SORT_FLAG_CASE);

            $wq = DB::table('water_quality_classes')->pluck('name','code')->all();
            $classesOut = [];
            foreach ($classes as $code => $cnt) {
                $classesOut[] = [ 'code' => $code, 'name' => ($wq[$code] ?? $code), 'count' => $cnt ];
            }

            return [
                'regions' => collect($regions)->map(fn($cnt,$v)=>['value'=>$v,'count'=>$cnt])->values(),
                'provinces' => collect($provinces)->map(fn($cnt,$v)=>['value'=>$v,'count'=>$cnt])->values(),
                'municipalities' => collect($municipalities)->map(fn($cnt,$v)=>['value'=>$v,'count'=>$cnt])->values(),
                'classes' => $classesOut,
            ];
        });

        return response()->json($payload);
    }

    private function buildPgWhere(array $filters): array
    {
        $where = ['1=1'];
        $bind = [];
        $r = $filters['region'] ?? null;
        $p = $filters['province'] ?? null;
        $m = $filters['municipality'] ?? null;
        $c = $filters['class_code'] ?? ($filters['classCode'] ?? null);
        if ($r) { $where[] = 'region @> ?::jsonb'; $bind[] = json_encode([$r]); }
        if ($p) { $where[] = 'province @> ?::jsonb'; $bind[] = json_encode([$p]); }
        if ($m) { $where[] = 'municipality @> ?::jsonb'; $bind[] = json_encode([$m]); }
        if ($c) { $where[] = 'class_code = ?'; $bind[] = $c; }
        return [implode(' AND ', $where), $bind];
    }

    private function pgFacets(?string $region, ?string $province, ?string $municipality, ?string $classCode)
    {
        [$where, $bind] = $this->buildPgWhere(compact('region','province','municipality','classCode'));

        // Regions
        $sqlRegions = "SELECT v as value, COUNT(DISTINCT id) as count
                        FROM (
                          SELECT id, jsonb_array_elements_text(region) as v
                          FROM lakes
                          WHERE $where
                        ) s
                        GROUP BY v
                        ORDER BY v";
        $regions = DB::select($sqlRegions, $bind);

        // Provinces
        $sqlProvinces = "SELECT v as value, COUNT(DISTINCT id) as count
                        FROM (
                          SELECT id, jsonb_array_elements_text(province) as v
                          FROM lakes
                          WHERE $where
                        ) s
                        GROUP BY v
                        ORDER BY v";
        $provinces = DB::select($sqlProvinces, $bind);

        // Municipalities
        $sqlMunicipalities = "SELECT v as value, COUNT(DISTINCT id) as count
                        FROM (
                          SELECT id, jsonb_array_elements_text(municipality) as v
                          FROM lakes
                          WHERE $where
                        ) s
                        GROUP BY v
                        ORDER BY v";
        $municipalities = DB::select($sqlMunicipalities, $bind);

        // Classes
        $sqlClasses = "SELECT l.class_code as code, COALESCE(wqc.name, l.class_code) as name, COUNT(*) as count
                        FROM lakes l
                        LEFT JOIN water_quality_classes wqc ON wqc.code = l.class_code
                        WHERE $where AND l.class_code IS NOT NULL
                        GROUP BY l.class_code, wqc.name
                        ORDER BY name";
        $classes = DB::select($sqlClasses, $bind);

        return [
            'regions' => $regions,
            'provinces' => $provinces,
            'municipalities' => $municipalities,
            'classes' => $classes,
        ];
    }

    private function buildMyWhere(array $filters): array
    {
        $where = ['1=1'];
        $bind = [];
        $r = $filters['region'] ?? null;
        $p = $filters['province'] ?? null;
        $m = $filters['municipality'] ?? null;
        $c = $filters['class_code'] ?? ($filters['classCode'] ?? null);
        if ($r) { $where[] = 'JSON_CONTAINS(region, JSON_ARRAY(?))'; $bind[] = $r; }
        if ($p) { $where[] = 'JSON_CONTAINS(province, JSON_ARRAY(?))'; $bind[] = $p; }
        if ($m) { $where[] = 'JSON_CONTAINS(municipality, JSON_ARRAY(?))'; $bind[] = $m; }
        if ($c) { $where[] = 'class_code = ?'; $bind[] = $c; }
        return [implode(' AND ', $where), $bind];
    }

    private function mysqlFacets(?string $region, ?string $province, ?string $municipality, ?string $classCode)
    {
        [$where, $bind] = $this->buildMyWhere(compact('region','province','municipality','classCode'));

        // Use JSON_TABLE to unnest arrays (MySQL 8+). If unavailable, this SQL may fail; environments should be on 8+.
        $sqlRegions = "SELECT jt.value AS value, COUNT(DISTINCT l.id) AS count
                       FROM lakes l
                       JOIN JSON_TABLE(l.region, '$[*]' COLUMNS (value VARCHAR(255) PATH '$')) jt
                       WHERE $where
                       GROUP BY jt.value
                       ORDER BY jt.value";
        $regions = DB::select($sqlRegions, $bind);

        $sqlProvinces = "SELECT jt.value AS value, COUNT(DISTINCT l.id) AS count
                       FROM lakes l
                       JOIN JSON_TABLE(l.province, '$[*]' COLUMNS (value VARCHAR(255) PATH '$')) jt
                       WHERE $where
                       GROUP BY jt.value
                       ORDER BY jt.value";
        $provinces = DB::select($sqlProvinces, $bind);

        $sqlMunicipalities = "SELECT jt.value AS value, COUNT(DISTINCT l.id) AS count
                       FROM lakes l
                       JOIN JSON_TABLE(l.municipality, '$[*]' COLUMNS (value VARCHAR(255) PATH '$')) jt
                       WHERE $where
                       GROUP BY jt.value
                       ORDER BY jt.value";
        $municipalities = DB::select($sqlMunicipalities, $bind);

        $sqlClasses = "SELECT l.class_code as code, COALESCE(wqc.name, l.class_code) as name, COUNT(*) as count
                       FROM lakes l
                       LEFT JOIN water_quality_classes wqc ON wqc.code = l.class_code
                       WHERE $where AND l.class_code IS NOT NULL
                       GROUP BY l.class_code, wqc.name
                       ORDER BY name";
        $classes = DB::select($sqlClasses, $bind);

        return [
            'regions' => $regions,
            'provinces' => $provinces,
            'municipalities' => $municipalities,
            'classes' => $classes,
        ];
    }
}
