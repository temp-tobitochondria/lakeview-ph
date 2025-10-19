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
}
