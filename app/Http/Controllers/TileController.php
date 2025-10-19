<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class TileController extends Controller
{
    /**
     * Return Mapbox Vector Tile (PBF) for contours at z/x/y.
     * URL: /api/tiles/contours/{z}/{x}/{y}.pbf
     */
    public function contours(int $z, int $x, int $y)
    {
        // Use PostGIS 3.x ST_TileEnvelope for 3857 tile bounds.
        // Be tolerant to schema differences: use geom_3857 if present, else transform geom on the fly.
        $sql = <<<'SQL'
WITH bounds AS (
  SELECT ST_TileEnvelope(:z, :x, :y) AS env
),
src AS (
  SELECT
    c.id,
    c.elev,
    -- derive index contours every 50 m
  CASE WHEN (ROUND(c.elev)::int % 50) = 0 THEN 1 ELSE 0 END AS idx,
    COALESCE(c.geom_3857, ST_Transform(c.geom, 3857)) AS g
  FROM public.contours c
),
feats AS (
  SELECT
    id,
    elev,
    idx,
    ST_AsMVTGeom(src.g, bounds.env, 4096, 64, true) AS geom
  FROM src, bounds
  WHERE src.g && bounds.env
),
mvt AS (
  SELECT ST_AsMVT(feats, 'contours', 4096, 'geom') AS tile FROM feats
)
SELECT encode(tile, 'base64') AS b64 FROM mvt;
SQL;

        $row = DB::selectOne($sql, ['z' => $z, 'x' => $x, 'y' => $y]);
        if (!$row || !isset($row->b64)) {
            return new Response('', 204);
        }

        $bytes = base64_decode($row->b64);

        return response($bytes, 200)
            ->header('Content-Type', 'application/vnd.mapbox-vector-tile')
            ->header('Cache-Control', 'public, max-age=86400')
            ->header('Access-Control-Allow-Origin', '*');
    }

    /**
     * Return GeoJSON FeatureCollection of label points for contours within the given bbox.
     * GET /api/contours/labels?bbox=minLon,minLat,maxLon,maxLat&z=14
     * Only returns data for z >= 14 to reduce clutter.
     */
    public function contourLabels(Request $request)
    {
        $bbox = $request->query('bbox');
        $z = (int) $request->query('z', 0);
        if (!$bbox || $z < 14) {
            return response()->json(['type' => 'FeatureCollection', 'features' => []]);
        }

        $parts = array_map('trim', explode(',', $bbox));
        if (count($parts) !== 4) {
            return response()->json(['type' => 'FeatureCollection', 'features' => []]);
        }
        [$minLon, $minLat, $maxLon, $maxLat] = array_map('floatval', $parts);

        // Build envelope in WGS84
        $sql = <<<'SQL'
WITH bb AS (
  SELECT ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326) AS env
), src AS (
  SELECT
    c.id,
    c.elev,
    CASE WHEN (ROUND(c.elev)::int % 50) = 0 THEN 1 ELSE 0 END AS idx,
    -- prefer original 4326 geom if present, else transform from 3857
    COALESCE(c.geom, ST_Transform(c.geom_3857, 4326)) AS g4326
  FROM public.contours c
), vis AS (
  SELECT id, elev, idx, g4326
  FROM src, bb
  WHERE g4326 && bb.env
)
SELECT id, elev,
       -- geometry for label point
       ST_AsGeoJSON(label_pt) AS geom,
       -- rotation angle (degrees) based on local azimuth, normalized to keep text readable
       CASE
         WHEN deg > 90 AND deg <= 270 THEN deg - 180
         ELSE deg
       END AS angle
FROM (
  SELECT id, elev, idx, g4326,
         lm,
         COALESCE(NULLIF(ST_LineInterpolatePoint(lm, 0.5), NULL), ST_PointOnSurface(g4326)) AS label_pt,
         DEGREES(
           COALESCE(
             ST_Azimuth(
               ST_LineInterpolatePoint(lm, GREATEST(0.0, LEAST(1.0, 0.5 - 0.01))),
               ST_LineInterpolatePoint(lm, GREATEST(0.0, LEAST(1.0, 0.5 + 0.01)))
             ),
             0
           )
         ) AS deg
  FROM (
    SELECT id, elev, idx, g4326, ST_LineMerge(g4326) AS lm FROM vis
  ) m
) q
-- label only index contours to reduce clutter
WHERE idx = 1
LIMIT 2000;
SQL;

        $rows = DB::select($sql, [
            'minLon' => $minLon,
            'minLat' => $minLat,
            'maxLon' => $maxLon,
            'maxLat' => $maxLat,
        ]);

        $features = [];
    foreach ($rows as $r) {
            if (!$r || empty($r->geom)) continue;
            $geom = json_decode($r->geom, true);
            if (!$geom) continue;
            $features[] = [
                'type' => 'Feature',
                'id' => $r->id,
        'properties' => [ 'elev' => $r->elev, 'angle' => isset($r->angle) ? (float)$r->angle : 0.0 ],
                'geometry' => $geom,
            ];
        }

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ])->header('Access-Control-Allow-Origin', '*');
    }
}
