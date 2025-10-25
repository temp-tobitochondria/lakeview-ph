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
        // On-the-fly contour generation from raster table public.de_ph using PostGIS raster ST_Contour
        // Only 100 m intervals are generated to reduce clutter and CPU cost
        $sql = <<<'SQL'
WITH bounds AS (
  SELECT ST_TileEnvelope(:z, :x, :y) AS env3857
), rast_src AS (
  -- Select rasters intersecting the tile bounds (transform bounds to raster SRID)
  SELECT r.rast, ST_SRID(r.rast) AS s
  FROM public.de_ph r
  JOIN bounds b ON ST_Intersects(r.rast, ST_Transform(b.env3857, ST_SRID(r.rast)))
), clipped AS (
  -- Clip each raster to the tile envelope (in raster SRID) to limit work
  SELECT ST_Clip(rast, ST_Transform((SELECT env3857 FROM bounds), s)) AS rast
  FROM rast_src
), contours AS (
  -- Generate 100 m interval contour polylines from the clipped rasters
  SELECT c.geom AS g, c.elev AS elev
  FROM clipped
  CROSS JOIN LATERAL ST_Contour(clipped.rast, 1, 100.0) AS c(geom, elev)
), ct AS (
  -- Reproject to 3857 for MVT packing and keep within tile bounds
  SELECT ST_Transform(g, 3857) AS g3857, elev FROM contours
), feats AS (
  SELECT
    row_number() OVER ()::bigint AS id,
    elev,
    1 AS idx, -- all are index contours since we only emit 100 m intervals
    ST_AsMVTGeom(ct.g3857, b.env3857, 4096, 64, true) AS geom
  FROM ct
  CROSS JOIN bounds b
  WHERE ct.g3857 && b.env3857
), mvt AS (
  SELECT ST_AsMVT(feats, 'contours', 4096, 'geom') AS tile FROM feats
)
SELECT encode(tile, 'base64') AS b64 FROM mvt;
SQL;

        // Enable raster access for this session (safe no-ops if not supported)
        try { DB::statement("SET LOCAL postgis.gdal_enabled_drivers = 'ENABLE_ALL'"); } catch (\Throwable $e) {}
        try { DB::statement("SET LOCAL postgis.enable_outdb_rasters = 'on'"); } catch (\Throwable $e) {}

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
        // Generate label points on-the-fly from de_ph contours within bbox (100 m intervals only)
        $sql = <<<'SQL'
WITH bb AS (
  SELECT ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326) AS env4326
), rast_src AS (
  -- select rasters intersecting the bbox (transform bbox to raster SRID)
  SELECT r.rast, ST_SRID(r.rast) AS s
  FROM public.de_ph r
  JOIN bb ON ST_Intersects(r.rast, ST_Transform(bb.env4326, ST_SRID(r.rast)))
), clipped AS (
  -- clip to bbox for efficiency
  SELECT ST_Clip(rast, ST_Transform((SELECT env4326 FROM bb), s)) AS rast
  FROM rast_src
), contours AS (
  -- produce 100 m contours
  SELECT c.geom AS g, c.elev AS elev
  FROM clipped
  CROSS JOIN LATERAL ST_Contour(clipped.rast, 1, 100.0) AS c(geom, elev)
), c4326 AS (
  SELECT ST_Transform(g, 4326) AS g4326, elev
  FROM contours
), vis AS (
  SELECT g4326, elev
  FROM c4326, bb
  WHERE g4326 && bb.env4326
), merged AS (
  SELECT elev, ST_LineMerge(g4326) AS lm FROM vis
)
SELECT
  -- synthetic id as hash of geom + elev to keep response light; client doesn't rely on stable ids here
  md5(ST_AsBinary(lm) || elev::text) AS id,
  elev,
  ST_AsGeoJSON(
    COALESCE(NULLIF(ST_LineInterpolatePoint(lm, 0.5), NULL), ST_PointOnSurface(lm))
  ) AS geom,
  CASE
    WHEN deg > 90 AND deg <= 270 THEN deg - 180
    ELSE deg
  END AS angle
FROM (
  SELECT elev, lm,
         DEGREES(
           COALESCE(
             ST_Azimuth(
               ST_LineInterpolatePoint(lm, GREATEST(0.0, LEAST(1.0, 0.5 - 0.01))),
               ST_LineInterpolatePoint(lm, GREATEST(0.0, LEAST(1.0, 0.5 + 0.01)))
             ),
             0
           )
         ) AS deg
  FROM merged
) q
-- all contours are 100 m, treat them as index labels; limit for safety
LIMIT 2000;
SQL;

    // Enable raster access for this session (safe no-ops if not supported)
    try { DB::statement("SET LOCAL postgis.gdal_enabled_drivers = 'ENABLE_ALL'"); } catch (\Throwable $e) {}
    try { DB::statement("SET LOCAL postgis.enable_outdb_rasters = 'on'"); } catch (\Throwable $e) {}

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
