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

    // Contour labels endpoint removed intentionally
}
