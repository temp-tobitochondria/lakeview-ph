<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class TileController extends Controller
{
    /**
     * Return Mapbox Vector Tile (PBF) for contours at z/x/y.
     * URL: /api/tiles/contours/{z}/{x}/{y}.pbf
     */
    public function contours(int $z, int $x, int $y)
    {
        // Compute a zoom-dependent simplification tolerance (meters per pixel at tile center)
        // This reduces vertex count for higher performance without visible quality loss.
        $resMetersPerPx = $this->metersPerPixelAtTile($z, $x, $y); // ~1px tolerance

        // Cache key for this tile. Bump version if SQL/logic changes to invalidate old cache.
        $cacheKey = sprintf('mvt:contours:v2:%d:%d:%d', $z, $x, $y);

        $bytes = Cache::remember($cacheKey, now()->addDays(7), function () use ($z, $x, $y, $resMetersPerPx) {
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
), simplified AS (
  -- Simplify by ~1 pixel at this zoom to reduce vertex count substantially
  SELECT ST_Simplify(g3857, :tol) AS gsim, elev FROM ct
), feats AS (
  SELECT
    row_number() OVER ()::bigint AS id,
    elev,
    1 AS idx, -- all are index contours since we only emit 100 m intervals
    ST_AsMVTGeom(simplified.gsim, b.env3857, 4096, 64, true) AS geom
  FROM simplified
  CROSS JOIN bounds b
  WHERE simplified.gsim IS NOT NULL
    AND simplified.gsim && b.env3857
), mvt AS (
  SELECT ST_AsMVT(feats, 'contours', 4096, 'geom') AS tile FROM feats
)
SELECT encode(tile, 'base64') AS b64 FROM mvt;
SQL;
            // Enable raster access for this session (safe no-ops if not supported)
            try { DB::statement("SET LOCAL postgis.gdal_enabled_drivers = 'ENABLE_ALL'"); } catch (\Throwable $e) {}
            try { DB::statement("SET LOCAL postgis.enable_outdb_rasters = 'on'"); } catch (\Throwable $e) {}

            $row = DB::selectOne($sql, ['z' => $z, 'x' => $x, 'y' => $y, 'tol' => $resMetersPerPx]);
            if (!$row || !isset($row->b64)) {
                // Cache an empty tile marker for a short time to avoid stampede
                return null;
            }
            return base64_decode($row->b64);
        });

        if (!$bytes) {
            return new Response('', 204);
        }

        // ETag support to allow client 304s on revalidation
        $etag = '"' . sha1($bytes) . '"';
        if (request()->headers->get('If-None-Match') === $etag) {
            return response('', 304)
                ->header('ETag', $etag)
                ->header('Cache-Control', 'public, max-age=604800, immutable')
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Content-Type', 'application/vnd.mapbox-vector-tile');
        }

        return response($bytes, 200)
            ->header('Content-Type', 'application/vnd.mapbox-vector-tile')
            ->header('Cache-Control', 'public, max-age=604800, immutable')
            ->header('ETag', $etag)
            ->header('Access-Control-Allow-Origin', '*');
    }


    /**
     * Approximate meters-per-pixel at the center of a Web Mercator tile (z/x/y).
     * Used to choose a sensible ST_Simplify tolerance per zoom level.
     */
    private function metersPerPixelAtTile(int $z, int $x, int $y): float
    {
        // latitude of tile center from TMS tile to lat conversion
        // n = pi - 2*pi*(y+0.5)/2^z; lat = atan(sinh(n))
        $n = M_PI - 2.0 * M_PI * ($y + 0.5) / (1 << $z);
        $latRad = atan(sinh($n));
        // ground resolution (meters/pixel) at latitude
        $mpp = 156543.03392804097 * cos($latRad) / (1 << $z);
        // Use ~1 pixel as simplification tolerance, but cap minimum to avoid zero
        return max($mpp, 0.1);
    }
}
