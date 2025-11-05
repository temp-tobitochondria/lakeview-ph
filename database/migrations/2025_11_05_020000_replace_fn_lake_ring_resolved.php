<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return; // Only relevant for Postgres/PostGIS
        }

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.fn_lake_ring_resolved(
    p_lake_id bigint,
    p_radius_km numeric,
    p_layer_id bigint DEFAULT NULL
) RETURNS geometry LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_geom geometry;
    v_ring geometry;
    v_dist_m numeric := GREATEST(COALESCE(p_radius_km, 0) * 1000.0, 0);
    v_geomtype text;
BEGIN
    IF v_dist_m <= 0 THEN
        RETURN NULL;
    END IF;

    -- Prefer explicit layer when provided
    IF p_layer_id IS NOT NULL THEN
        SELECT geom INTO v_geom FROM public.layers WHERE id = p_layer_id AND geom IS NOT NULL LIMIT 1;
    END IF;

    -- Otherwise resolve the (single) layer for this lake body
    IF v_geom IS NULL THEN
        SELECT geom
          INTO v_geom
          FROM public.layers
         WHERE body_type = 'lake' AND body_id = p_lake_id
         ORDER BY id DESC
         LIMIT 1;
    END IF;

    -- Fallback: use lakes.coordinates point when polygon geometry is unavailable
    IF v_geom IS NULL THEN
        SELECT coordinates INTO v_geom FROM public.lakes WHERE id = p_lake_id AND coordinates IS NOT NULL LIMIT 1;
    END IF;

    IF v_geom IS NULL THEN
        RETURN NULL; -- no geometry to work with
    END IF;

    v_geomtype := GeometryType(v_geom);

    -- Compute a ring around polygon shorelines; for point fallback, just a buffer circle
    IF v_geomtype IN ('POLYGON','MULTIPOLYGON') THEN
        -- Buffer in meters using geography for accuracy, then subtract original water polygon
        v_ring := ST_Difference((ST_Buffer(v_geom::geography, v_dist_m))::geometry, v_geom);
    ELSE
        v_ring := (ST_Buffer(v_geom::geography, v_dist_m))::geometry;
    END IF;

    -- Ensure SRID=4326
    IF ST_SRID(v_ring) IS DISTINCT FROM 4326 THEN
        v_ring := ST_SetSRID(v_ring, 4326);
    END IF;

    RETURN v_ring;
END$$;
SQL);
    }

    public function down(): void
    {
        // No-op: we don't know the previous definition reliably; keep the safe version in place.
    }
};
