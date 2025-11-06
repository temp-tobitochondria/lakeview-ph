<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            // Only apply on PostgreSQL
            return;
        }

        // Enable pg_trgm for fast ILIKE/substring search (idempotent)
        try { DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm'); } catch (\Throwable $e) {}

        // Trigram GIN indexes for name and alt_name
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_name_trgm_idx ON lakes USING gin (name gin_trgm_ops)'); } catch (\Throwable $e) {}
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_alt_name_trgm_idx ON lakes USING gin (alt_name gin_trgm_ops)'); } catch (\Throwable $e) {}

        // JSONB array contains filters: create GIN indexes if columns are jsonb
        // Guard with DO block so environments with text/varchar columns won't error
        $jsonIndexBlock = <<<SQL
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'lakes' AND column_name = 'region' AND data_type = 'jsonb'
            ) THEN
                BEGIN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS lakes_region_gin_idx ON lakes USING gin (region)';
                EXCEPTION WHEN others THEN
                    -- ignore
                END;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'lakes' AND column_name = 'province' AND data_type = 'jsonb'
            ) THEN
                BEGIN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS lakes_province_gin_idx ON lakes USING gin (province)';
                EXCEPTION WHEN others THEN
                END;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'lakes' AND column_name = 'municipality' AND data_type = 'jsonb'
            ) THEN
                BEGIN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS lakes_municipality_gin_idx ON lakes USING gin (municipality)';
                EXCEPTION WHEN others THEN
                END;
            END IF;
        END $$;
        SQL;
        try { DB::statement($jsonIndexBlock); } catch (\Throwable $e) {}

        // Helpful btree indexes for frequent sorts/filters
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_name_idx ON lakes (name)'); } catch (\Throwable $e) {}
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_class_code_idx ON lakes (class_code)'); } catch (\Throwable $e) {}
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_watershed_id_idx ON lakes (watershed_id)'); } catch (\Throwable $e) {}
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_created_at_idx ON lakes (created_at)'); } catch (\Throwable $e) {}
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_updated_at_idx ON lakes (updated_at)'); } catch (\Throwable $e) {}

        // Composite index to speed up flows_status filtered sorts by name (optional)
        try { DB::statement('CREATE INDEX IF NOT EXISTS lakes_flows_status_name_idx ON lakes (flows_status, name)'); } catch (\Throwable $e) {}
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        // Drop created indexes (keep extension as it may be used elsewhere)
        $drops = [
            'lakes_name_trgm_idx',
            'lakes_alt_name_trgm_idx',
            'lakes_region_gin_idx',
            'lakes_province_gin_idx',
            'lakes_municipality_gin_idx',
            'lakes_name_idx',
            'lakes_class_code_idx',
            'lakes_watershed_id_idx',
            'lakes_created_at_idx',
            'lakes_updated_at_idx',
            'lakes_flows_status_name_idx',
        ];
        foreach ($drops as $idx) {
            try { DB::statement('DROP INDEX IF EXISTS ' . $idx); } catch (\Throwable $e) {}
        }
    }
};
