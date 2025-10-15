<?php

namespace App\Http\Controllers;

use App\Services\Semantic\SemanticSearch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SearchController extends Controller
{
    public function __construct(private SemanticSearch $search) {}

    public function query(Request $request)
    {
        $q = (string) $request->input('query', '');
        if (trim($q) === '') return response()->json(['error' => 'query is required'], 422);

        // Normalize & options
        $limitParam = (int) $request->input('limit', 20);
        $limit = max(1, min(100, $limitParam));
        $qlc = strtolower(trim($q));

        // Helper: extract place after "in ..."
        $extractPlace = function(string $text): ?string {
            $lc = strtolower($text);
            if (preg_match('/\bin\s+([\p{L}0-9\-\s]+)$/u', $lc, $m)) {
                $place = trim($m[1] ?? '');
                $place = trim($place, ".,!? ");
                return $place !== '' ? $place : null;
            }
            return null;
        };
        $place = $extractPlace($q);

        // Detect entity/table
        $entity = 'lakes';
        if (str_contains($qlc, 'watershed')) $entity = 'watersheds';
        elseif (str_contains($qlc, 'parameter')) $entity = 'parameters';
        elseif (str_contains($qlc, 'layer')) $entity = 'layers';
        elseif (str_contains($qlc, 'flow')) $entity = 'lake_flows';

        // Analytical keywords & top-N
        $hasLargest  = str_contains($qlc, 'largest') || str_contains($qlc, 'biggest') || str_contains($qlc, 'top');
        $hasSmallest = str_contains($qlc, 'smallest');
        $hasDeepest  = str_contains($qlc, 'deepest');
        $hasHighest  = str_contains($qlc, 'highest');
        $hasLowest   = str_contains($qlc, 'lowest');
        $hasLongest  = str_contains($qlc, 'longest');

        $topLimit = null;
        if (preg_match('/top\s+(\d{1,3})/i', $q, $m)) {
            $topLimit = max(1, min(100, (int)($m[1] ?? 0)));
        }
        $finalLimit = $topLimit ?? ($hasLargest || $hasSmallest || $hasDeepest || $hasHighest || $hasLowest || $hasLongest ? 5 : $limit);

        // Unified mapper
        $mapRows = function(array $rows, string $table, ?string $attributeUsed = null) use ($place) {
            return array_map(function($r) use ($table, $attributeUsed) {
                // stdClass -> array
                $row = is_array($r) ? $r : (array) $r;
                $id = $row['id'] ?? ($row['lake_id'] ?? ($row['layer_id'] ?? ($row['parameter_id'] ?? null)));
                $name = $row['name'] ?? ($row['lake_name'] ?? ($row['watershed_name'] ?? ($row['layer_name'] ?? ($row['parameter_name'] ?? null))));
                $geom = $row['geom'] ?? ($row['coordinates_geojson'] ?? null);
                // Add a human-friendly description for lakes if possible
                if ($table === 'lakes') {
                    $normText = function($v) {
                        if ($v === null) return '';
                        if (is_array($v)) return (string) ($v[0] ?? '');
                        if (is_string($v)) {
                            $s = trim($v);
                            if ($s !== '' && ($s[0] === '[' || $s[0] === '{')) {
                                try { $j = json_decode($s, true, 512, JSON_THROW_ON_ERROR); return (string) (($j[0] ?? '') ?: ''); } catch (\Throwable $e) { return $s; }
                            }
                            return $s;
                        }
                        return (string) $v;
                    };
                    $province = $normText($row['province'] ?? null);
                    $region   = $normText($row['region'] ?? null);
                    $locParts = [];
                    if ($province !== '') $locParts[] = $province;
                    if ($region !== '') $locParts[] = $region;
                    $loc = implode(', ', $locParts);
                    // Area handling (prefer precomputed km2/ha if present; else number + unit if provided)
                    $areaNum = null; $unit = null;
                    foreach (['surface_area_km2','area_km2'] as $k) { if (isset($row[$k]) && is_numeric($row[$k])) { $areaNum = (float)$row[$k]; $unit='km²'; break; } }
                    if ($areaNum === null) {
                        foreach (['surface_area_ha','area_ha'] as $k) { if (isset($row[$k]) && is_numeric($row[$k])) { $areaNum = (float)$row[$k]; $unit='ha'; break; } }
                    }
                    if ($areaNum === null && isset($row['area_km2_from_layer']) && is_numeric($row['area_km2_from_layer'])) {
                        $areaNum = (float)$row['area_km2_from_layer']; $unit='km²';
                    }
                    // Analytical metric inclusion (depth/elevation/area/shoreline)
                    $metricText = '';
                    if ($attributeUsed && isset($row['metric_value']) && is_numeric($row['metric_value'])) {
                        $mv = (float) $row['metric_value'];
                        if ($attributeUsed === 'depth') {
                            $metricText = 'with a mean depth of ' . rtrim(rtrim(number_format($mv, 1, '.', ''), '0'), '.') . ' m';
                        } elseif ($attributeUsed === 'elevation') {
                            $metricText = 'with an elevation of ' . rtrim(rtrim(number_format($mv, 1, '.', ''), '0'), '.') . ' m';
                        } elseif ($attributeUsed === 'shoreline_m') {
                            $km = $mv / 1000.0; // metres to km
                            $metricText = 'with a shoreline length of ' . rtrim(rtrim(number_format($km, 1, '.', ''), '0'), '.') . ' km';
                        } elseif ($attributeUsed === 'area_m2') {
                            $km2 = $mv / 1000000.0; // m² to km²
                            $metricText = 'with a surface area of ' . rtrim(rtrim(number_format($km2, 2, '.', ''), '0'), '.') . ' km²';
                        }
                    }
                    $areaText = $areaNum !== null ? (rtrim(rtrim(number_format($areaNum, 2, '.', ''), '0'), '.') . ($unit ? " {$unit}" : '')) : '';
                    $parts = [];
                    if ($loc !== '') $parts[] = sprintf('%s is in %s', $name, $loc); else $parts[] = sprintf('%s is a lake', $name);
                    if ($metricText !== '') {
                        $parts[] = $metricText;
                    } elseif ($areaText !== '') {
                        $parts[] = sprintf('with the surface area of %s', $areaText);
                    }
                    $desc = implode(' ', $parts) . '.';
                    $row['description'] = $desc;
                }
                // Keep original attributes too
                return [
                    'table' => $table,
                    'id' => $id,
                    'name' => $name,
                    'attributes' => $row,
                    'geom' => $geom,
                    'attribute_used' => $attributeUsed,
                ];
            }, $rows);
        };

        // Analytical handling per-entity (lakes/watersheds primarily)
        $isAnalytical = $hasLargest || $hasSmallest || $hasDeepest || $hasHighest || $hasLowest || $hasLongest;
        if ($isAnalytical && in_array($entity, ['lakes','watersheds'], true)) {
            $orderDir = ($hasSmallest || $hasLowest) ? 'ASC' : 'DESC';
            $params = ['limit' => $finalLimit];
            if ($place) $params['place'] = '%' . $place . '%';

            if ($entity === 'lakes') {
                // Decide metric
                $attributeUsed = 'area_m2';
                if ($hasDeepest) $attributeUsed = 'depth';
                elseif ($hasHighest || $hasLowest) $attributeUsed = 'elevation';
                elseif ($hasLongest) $attributeUsed = 'shoreline_m';

                if ($attributeUsed === 'area_m2') {
                    $sql = <<<SQL
SELECT l.id,
       COALESCE(NULLIF(l.name, ''), NULLIF(l.alt_name, ''), 'Lake') AS name,
       l.region, l.province,
       ST_AsGeoJSON(l.coordinates) AS coordinates_geojson,
       ST_Area(ly.geom::geography) AS metric_value
FROM lakes l
LEFT JOIN layers ly ON ly.body_type='lake' AND ly.body_id=l.id AND ly.is_active=true AND ly.visibility='public'
WHERE ly.geom IS NOT NULL
%s
ORDER BY metric_value {$orderDir} NULLS LAST
LIMIT :limit
SQL;
                } elseif ($attributeUsed === 'shoreline_m') {
                    $sql = <<<SQL
SELECT l.id,
       COALESCE(NULLIF(l.name, ''), NULLIF(l.alt_name, ''), 'Lake') AS name,
       l.region, l.province,
       ST_AsGeoJSON(l.coordinates) AS coordinates_geojson,
       ST_Perimeter(ly.geom::geography) AS metric_value
FROM lakes l
LEFT JOIN layers ly ON ly.body_type='lake' AND ly.body_id=l.id AND ly.is_active=true AND ly.visibility='public'
WHERE ly.geom IS NOT NULL
%s
ORDER BY metric_value {$orderDir} NULLS LAST
LIMIT :limit
SQL;
                } else { // depth / elevation from lakes table (schema uses mean_depth_m, elevation_m)
                    $col = $attributeUsed === 'depth' ? 'l.mean_depth_m' : 'l.elevation_m';
                    $sql = <<<SQL
SELECT l.id,
       COALESCE(NULLIF(l.name, ''), NULLIF(l.alt_name, ''), 'Lake') AS name,
       l.region, l.province,
       ST_AsGeoJSON(l.coordinates) AS coordinates_geojson,
       {$col} AS metric_value
FROM lakes l
WHERE {$col} IS NOT NULL
%s
ORDER BY metric_value {$orderDir} NULLS LAST
LIMIT :limit
SQL;
                }
                $wherePlace = $place ? "AND ((l.region::text) ILIKE :place OR (l.province::text) ILIKE :place)" : '';
                $rows = DB::select(sprintf($sql, $wherePlace), $params);
                return response()->json([
                    'data' => $mapRows($rows, 'lakes', $attributeUsed),
                    'intent' => [ 'code' => 'ANALYTICAL', 'metric' => $attributeUsed, 'order' => $orderDir, 'limit' => $finalLimit ],
                    'diagnostics' => [ 'approach' => 'controller-analytical', 'entity' => $entity, 'place' => $place ],
                ]);
            } else { // watersheds
                $attributeUsed = 'area_m2';
                // Compute area from published layers to avoid depending on missing columns on watersheds
                $sql = <<<SQL
                    SELECT w.id,
                           w.name AS name,
                           ST_AsGeoJSON(ly.geom) AS geom,
                           ST_Area(ly.geom::geography) AS metric_value
                    FROM watersheds w
                    LEFT JOIN layers ly ON ly.body_type='watershed' AND ly.body_id=w.id AND ly.is_active=true AND ly.visibility='public'
                    WHERE ly.geom IS NOT NULL
                    %s
                    ORDER BY metric_value {$orderDir} NULLS LAST
                    LIMIT :limit
                SQL;
                $wherePlace = $place ? "AND (w.name ILIKE :place OR COALESCE(w.description,'') ILIKE :place)" : '';
                $rows = DB::select(sprintf($sql, $wherePlace), $params);
                return response()->json([
                    'data' => $mapRows($rows, 'watersheds', $attributeUsed),
                    'intent' => [ 'code' => 'ANALYTICAL', 'metric' => $attributeUsed, 'order' => $orderDir, 'limit' => $finalLimit ],
                    'diagnostics' => [ 'approach' => 'controller-analytical', 'entity' => $entity, 'place' => $place ],
                ]);
            }
        }

        // Attribute/fuzzy search by entity using ILIKE
        $kw = '%' . trim($q) . '%';
        $rows = [];
        $tableUsed = $entity;
        if ($entity === 'lakes') {
            $sql = <<<SQL
                SELECT l.id,
                       COALESCE(NULLIF(l.name, ''), NULLIF(l.alt_name, ''), 'Lake') AS name,
                       l.class_code, l.region, l.province,
                       (CASE WHEN ly.geom IS NOT NULL THEN ST_Area(ly.geom::geography)/1000000.0 ELSE NULL END) AS area_km2_from_layer,
                       ST_AsGeoJSON(l.coordinates) AS coordinates_geojson
                FROM lakes l
                LEFT JOIN layers ly ON ly.body_type='lake' AND ly.body_id=l.id AND ly.is_active=true AND ly.visibility='public'
                WHERE (
                    l.name ILIKE :kw OR
                    l.alt_name ILIKE :kw OR
                    (l.region::text) ILIKE :kw OR
                    (l.province::text) ILIKE :kw
                )
                %s
                ORDER BY name ASC
                LIMIT :limit
            SQL;
            $wherePlace = $place ? "AND ((l.region::text) ILIKE :place OR (l.province::text) ILIKE :place)" : '';
            $params = ['kw' => $kw, 'limit' => $limit] + ($place ? ['place' => '%'.$place.'%'] : []);
            $rows = DB::select(sprintf($sql, $wherePlace), $params);
        } elseif ($entity === 'watersheds') {
            // Search by name/description; pull geom from active layer if available
            $sql = <<<SQL
                SELECT w.id,
                       COALESCE(w.name, COALESCE(ly.layer_name, ly.name)) AS name,
                       CASE WHEN ly.geom IS NOT NULL THEN ST_AsGeoJSON(ly.geom) ELSE NULL END AS geom
                FROM watersheds w
                LEFT JOIN layers ly ON ly.body_type='watershed' AND ly.body_id=w.id AND ly.is_active=true AND ly.visibility='public'
                WHERE (
                    w.name ILIKE :kw OR
                    COALESCE(w.description,'') ILIKE :kw OR
                    COALESCE(ly.layer_name, ly.name) ILIKE :kw
                )
                %s
                ORDER BY name ASC
                LIMIT :limit
            SQL;
            $wherePlace = $place ? "AND (w.name ILIKE :place OR COALESCE(w.description,'') ILIKE :place)" : '';
            $params = ['kw' => $kw, 'limit' => $limit] + ($place ? ['place' => '%'.$place.'%'] : []);
            $rows = DB::select(sprintf($sql, $wherePlace), $params);
        } elseif ($entity === 'layers') {
            $sql = <<<SQL
                SELECT ly.id,
                       COALESCE(ly.layer_name, ly.name) AS name,
                       ly.category, ly.description, ly.source,
                       CASE WHEN ly.geom IS NOT NULL THEN ST_AsGeoJSON(ly.geom) ELSE NULL END AS geom
                FROM layers ly
                WHERE (
                    COALESCE(ly.layer_name, ly.name) ILIKE :kw OR
                    ly.category ILIKE :kw OR
                    ly.description ILIKE :kw OR
                    ly.source ILIKE :kw
                )
                ORDER BY name ASC
                LIMIT :limit
            SQL;
            $params = ['kw' => $kw, 'limit' => $limit];
            $rows = DB::select($sql, $params);
        } elseif ($entity === 'parameters') {
            // Parameters table uses 'name'; include aliases if alias table exists
            $hasAliases = Schema::hasTable('parameter_aliases');
            if ($hasAliases) {
                $sql = <<<SQL
                    SELECT DISTINCT p.id,
                           p.name AS name,
                           p.category, p.unit
                    FROM parameters p
                    LEFT JOIN parameter_aliases pa ON pa.parameter_id = p.id
                    WHERE (
                        p.name ILIKE :kw OR p.code ILIKE :kw OR
                        COALESCE(p.category,'') ILIKE :kw OR
                        COALESCE(p.unit,'') ILIKE :kw OR
                        COALESCE(pa.alias,'') ILIKE :kw
                    )
                    ORDER BY name ASC
                    LIMIT :limit
                SQL;
            } else {
                $sql = <<<SQL
                    SELECT DISTINCT p.id,
                           p.name AS name,
                           p.category, p.unit
                    FROM parameters p
                    WHERE (
                        p.name ILIKE :kw OR p.code ILIKE :kw OR
                        COALESCE(p.category,'') ILIKE :kw OR
                        COALESCE(p.unit,'') ILIKE :kw
                    )
                    ORDER BY name ASC
                    LIMIT :limit
                SQL;
            }
            $params = ['kw' => $kw, 'limit' => $limit];
            $rows = DB::select($sql, $params);
        } elseif ($entity === 'lake_flows') {
            // Match available schema: name/alt_name/source/flow_type and the parent lake name
            $sql = <<<SQL
                SELECT f.id,
                       COALESCE(NULLIF(f.name,''), NULLIF(f.alt_name,''), CONCAT(f.flow_type, ' flow')) AS name,
                       f.flow_type,
                       f.source,
                       l.name AS lake_name,
                       ST_AsGeoJSON(f.coordinates) AS coordinates_geojson,
                       f.latitude, f.longitude
                FROM lake_flows f
                LEFT JOIN lakes l ON l.id = f.lake_id
                WHERE (
                    COALESCE(f.name, '') ILIKE :kw OR
                    COALESCE(f.alt_name, '') ILIKE :kw OR
                    COALESCE(f.source, '') ILIKE :kw OR
                    f.flow_type ILIKE :kw OR
                    COALESCE(l.name,'') ILIKE :kw
                )
                ORDER BY name ASC
                LIMIT :limit
            SQL;
            $params = ['kw' => $kw, 'limit' => $limit];
            $rows = DB::select($sql, $params);
        }

        // If we got attribute matches, return unified response
        if (!empty($rows)) {
            return response()->json([
                'data' => $mapRows($rows, $tableUsed, null),
                'intent' => [ 'code' => 'ATTRIBUTE', 'entity' => $tableUsed ],
                'diagnostics' => [ 'approach' => 'controller-attribute', 'place' => $place ],
            ]);
        }

        // If user asked for watersheds but nothing matched, return a small generic list to avoid "nothing shows"
        if ($entity === 'watersheds') {
            $fallback = DB::select(
                'SELECT w.id, w.name AS name, NULL::text AS geom FROM watersheds w ORDER BY w.name ASC LIMIT :limit',
                ['limit' => $limit]
            );
            if (!empty($fallback)) {
                return response()->json([
                    'data' => $mapRows($fallback, 'watersheds', null),
                    'intent' => [ 'code' => 'ATTRIBUTE', 'entity' => 'watersheds', 'note' => 'generic-fallback' ],
                    'diagnostics' => [ 'approach' => 'controller-attribute-fallback' ],
                ]);
            }
        }

        // Fallback: delegate to semantic engine
        $opts = [ 'limit' => $limit ];
        $out = $this->search->search($q, $opts);
        return response()->json([
            'data' => $out['results'] ?? [],
            'intent' => $out['intent'] ?? null,
            'diagnostics' => $out['diagnostics'] ?? null,
        ]);
    }

    /**
     * Lightweight suggestions for typeahead. Mixed entities, minimal fields.
     * GET /api/search/suggest?q=...&limit=8
     */
    public function suggest(Request $request)
    {
        $q = (string) $request->query('q', '');
        $q = trim($q);
        if ($q === '' || mb_strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

    $limitParam = (int) $request->query('limit', 8);
        $limit = max(1, min(20, $limitParam));
    $kw = '%' . $q . '%';
    // Tokenize to get last token for prefix behavior
    $tokens = preg_split('/[^\p{L}0-9]+/u', strtolower($q), -1, PREG_SPLIT_NO_EMPTY);
    $lastToken = $tokens ? end($tokens) : '';
    $kwp = ($lastToken !== '') ? ($lastToken . '%') : ($q . '%');
    $prefixOnly = ($lastToken !== '' && mb_strlen($lastToken) <= 3);
    $hasLakeWord = false;
    foreach ($tokens as $t) { if ($t === 'lake' || $t === 'lakes') { $hasLakeWord = true; break; } }
    $kwLake = '%lake%';
    $kwpLake = 'lake%';

        $results = [];

        // Lakes
        $sqlLakes = <<<SQL
            SELECT l.id,
                   COALESCE(NULLIF(l.name, ''), NULLIF(l.alt_name, ''), 'Lake') AS name,
                   'lakes' AS entity,
                   NULL::text AS subtitle,
                   CASE
                      WHEN l.name ILIKE :kwp OR l.alt_name ILIKE :kwp OR (:hasLake::boolean AND (l.name ILIKE :kwpLake OR l.alt_name ILIKE :kwpLake)) THEN 0
                     WHEN (l.region::text) ILIKE :kwp OR (l.province::text) ILIKE :kwp THEN 1
                      WHEN l.name ILIKE :kw OR l.alt_name ILIKE :kw OR (l.region::text) ILIKE :kw OR (l.province::text) ILIKE :kw OR (:hasLake::boolean AND (l.name ILIKE :kwLake OR l.alt_name ILIKE :kwLake)) THEN 2
                     ELSE 3
                   END AS rank
            FROM lakes l
            WHERE (
                l.name ILIKE :kw OR
                l.alt_name ILIKE :kw OR
                (l.region::text) ILIKE :kw OR
                (l.province::text) ILIKE :kw OR
                (:hasLake::boolean AND (l.name ILIKE :kwLake OR l.alt_name ILIKE :kwLake))
            )
            %s
            ORDER BY rank ASC, name ASC
            LIMIT :limit
        SQL;
        $extra = '';
        $params = ['kw' => $kw, 'kwp' => $kwp, 'kwLake' => $kwLake, 'kwpLake' => $kwpLake, 'hasLake' => $hasLakeWord ? 1 : 0, 'limit' => $limit];
        if ($prefixOnly) {
            $extra .= " AND (l.name ILIKE :kwp OR l.alt_name ILIKE :kwp OR (l.region::text) ILIKE :kwp OR (l.province::text) ILIKE :kwp OR (:hasLake::boolean AND (l.name ILIKE :kwpLake OR l.alt_name ILIKE :kwpLake)))";
        }
        if ($hasLakeWord) {
            $extra .= " AND (COALESCE(l.name,'') ILIKE '%lake%' OR COALESCE(l.alt_name,'') ILIKE '%lake%')";
        }
        $rows = DB::select(sprintf($sqlLakes, $extra), $params);
        foreach ($rows as $r) {
            $results[] = [ 'entity' => 'lakes', 'id' => $r->id, 'label' => $r->name, 'subtitle' => null ];
        }

        // Watersheds suggestions removed per refinement request

        // Layers and Parameters suggestions intentionally removed per refinement request

        // Optional: analytical hint when matching keywords
        $qlc = strtolower($q);
        if (count($results) > 0 && (str_contains($qlc, 'largest') || str_contains($qlc, 'deepest') || str_contains($qlc, 'highest') || str_contains($qlc, 'lowest'))) {
            array_unshift($results, [
                'entity' => 'hint',
                'id' => null,
                'label' => 'Press Enter to run analytical search',
                'subtitle' => null,
            ]);
            // Trim back to limit
            $results = array_slice($results, 0, $limit);
        }

        return response()->json(['data' => $results]);
    }
}
